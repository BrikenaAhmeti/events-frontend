import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { ConciergeWorkspace } from './ConciergeWorkspace';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const historyEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/messages';
const streamEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/stream';

describe('ConciergeWorkspace', () => {
  it('offers guest questions that fit any event', async () => {
    server.use(
      http.get(historyEndpoint, () => HttpResponse.json({ messages: [] })),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);
    expect(await screen.findByRole('button', { name: 'What should I know about this event?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'When does the event start?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Where is the event taking place?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What time is dinner?' })).not.toBeInTheDocument();
  });

  it('loads history and renders a streamed guest answer', async () => {
    let releaseResponse: (() => void) | undefined;
    const holdResponse = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
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
        await holdResponse;
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
      screen.getByText('Where is registration?').closest('[data-message-role="user"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Preparing a response' })).toBeInTheDocument();
    releaseResponse?.();

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

  it('shows the shareable guest link and QR code inside the organizer conversation', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/events/event-a/concierge/messages', () =>
        HttpResponse.json({ id: null, messages: [] }),
      ),
    );

    renderApp(
      <ConciergeWorkspace
        eventId="event-a"
        shareAccess={{
          url: 'https://events.example.test/e/leadership-forum',
          qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        }}
      />,
    );

    expect(await screen.findByText('Guest access is ready to share')).toBeInTheDocument();
    expect(screen.getByText('https://events.example.test/e/leadership-forum')).toBeInTheDocument();
    expect(screen.getByAltText('Guest access QR code')).toBeInTheDocument();
  });

  it('continues from ready details through guest chat and publishes in the conversation', async () => {
    const extract = vi.fn(() =>
      HttpResponse.json({
        applied: true,
        addedGuests: 2,
        message: { id: 'added-guests', content: 'Added 2 guests. Continue to publishing.' },
        completeness: { ready: true, missing: [] },
      }),
    );
    const publish = vi.fn(() => HttpResponse.json({ status: 'PUBLISHED' }));
    server.use(
      http.get('http://localhost:3000/api/v1/events/event-a/concierge/messages', () =>
        HttpResponse.json({ id: null, messages: [] }),
      ),
      http.post('http://localhost:3000/api/v1/events/event-a/concierge/extract', extract),
      http.post('http://localhost:3000/api/v1/events/event-a/publish', publish),
    );
    renderApp(
      <ConciergeWorkspace
        eventId="event-a"
        eventStatus="READY"
        ready
        allowPlanning
        allowGuestManage
        allowPublish
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Add guests here or upload a CSV or Excel guest list/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Write a message…'), 'Alex Morgan, alex@example.com; Sam Lee, sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Added 2 guests. Continue to publishing.')).toBeInTheDocument();
    expect(extract).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Continue to publish' }));
    await user.click(screen.getByRole('button', { name: 'Publish event' }));
    expect(publish).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Event published/)).toBeInTheDocument();
  });

  it('reviews a CSV in the guest step and can publish without sending invitations', async () => {
    let publishBody: { sendInvitations?: boolean } | undefined;
    const imported = vi.fn(() => HttpResponse.json({ accepted: 1 }));
    server.use(
      http.get('http://localhost:3000/api/v1/events/event-a/concierge/messages', () => HttpResponse.json({ id: null, messages: [] })),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/preview', () => HttpResponse.json({
        mapping: { Name: 'fullName', Email: 'email' },
        rows: [{ row: 2, values: { Name: 'Avery Stone', Email: 'avery@example.test' }, data: { fullName: 'Avery Stone', email: 'avery@example.test' }, errors: [], duplicate: false }],
        validRows: [{ fullName: 'Avery Stone', email: 'avery@example.test' }], invalidRows: [], duplicates: [],
        summary: { total: 1, valid: 1, invalid: 0, duplicates: 0 },
      })),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/confirm', imported),
      http.post('http://localhost:3000/api/v1/events/event-a/publish', async ({ request }) => {
        publishBody = await request.json() as { sendInvitations?: boolean };
        return HttpResponse.json({ status: 'PUBLISHED', invitationsQueued: 0 });
      }),
    );
    const rendered = renderApp(<ConciergeWorkspace eventId="event-a" eventStatus="READY" ready allowPlanning allowGuestManage allowGuestImport allowPublish />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    const fileInput = rendered.container.querySelector('input[accept=".csv,.xlsx"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['Name,Email\nAvery Stone,avery@example.test'], 'guests.csv', { type: 'text/csv' }));
    await screen.findByRole('dialog', { name: 'Import preview' });
    await user.click(screen.getByRole('button', { name: 'Add guests only' }));
    await waitFor(() => expect(imported).toHaveBeenCalledOnce());
    await screen.findByText(/1 guests added/);
    await user.click(screen.getByRole('button', { name: 'Continue to publish' }));
    await user.click(screen.getByRole('button', { name: 'Publish without sending invitations' }));
    await user.click(screen.getByRole('button', { name: 'Publish event' }));
    await waitFor(() => expect(publishBody).toEqual({ sendInvitations: false }));
  });
});
