import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { ConciergeWorkspace } from './ConciergeWorkspace';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const historyEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/messages';
const streamEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/stream';

describe('ConciergeWorkspace', () => {
  it('loads history and renders a streamed guest answer', async () => {
    server.use(
      http.get(historyEndpoint, () =>
        HttpResponse.json({
          id: 'conversation-a',
          messages: [{ id: 'message-a', role: 'CONCIERGE', content: 'Welcome to the event.' }],
        }),
      ),
      http.post(streamEndpoint, async ({ request }) => {
        const body = (await request.json()) as { message: string };
        expect(body.message).toBe('Where is registration?');
        return new HttpResponse(
          [
            JSON.stringify({ type: 'status', messageId: 'message-b', status: 'PROCESSING' }),
            JSON.stringify({ type: 'delta', messageId: 'message-b', delta: 'Registration is in ' }),
            JSON.stringify({
              type: 'delta',
              messageId: 'message-b',
              delta: 'the Riverside Hall foyer.',
            }),
            JSON.stringify({
              type: 'message',
              message: {
                id: 'message-b',
                role: 'CONCIERGE',
                content: 'Registration is in the Riverside Hall foyer.',
              },
            }),
          ].join('\n'),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        );
      }),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);
    expect(await screen.findByText('Welcome to the event.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Write a message…'), 'Where is registration?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText('Registration is in the Riverside Hall foyer.'),
    ).toBeInTheDocument();
  });

  it('shows a useful recovery message when Concierge is unavailable', async () => {
    server.use(
      http.get(historyEndpoint, () => HttpResponse.json({ id: null, messages: [] })),
      http.post(streamEndpoint, () =>
        HttpResponse.json(
          {
            statusCode: 503,
            code: 'CONCIERGE_UNAVAILABLE',
            message: 'Concierge is temporarily unavailable.',
            details: {},
            requestId: 'request-a',
          },
          { status: 503 },
        ),
      ),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Write a message…'), 'What starts next?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText('Concierge could not respond. Please try again.'),
    ).toBeInTheDocument();
  });
});
