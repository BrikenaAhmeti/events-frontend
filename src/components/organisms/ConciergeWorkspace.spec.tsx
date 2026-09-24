import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { ConciergeWorkspace } from './ConciergeWorkspace';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const historyEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/messages';
const streamEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/stream';
const chatsEndpoint = 'http://localhost:3000/api/v1/guest/events/event-a/concierge/chats';

describe('ConciergeWorkspace', () => {
  it('asks for a language first, then shows the AI’s opening question', async () => {
    server.use(
      http.get(historyEndpoint, () => HttpResponse.json({ id: null, language: null, messages: [] })),
      http.post(chatsEndpoint, async ({ request }) => {
        expect(await request.json()).toEqual({ language: 'en' });
        return HttpResponse.json({ id: 'new-chat', language: 'en', messages: [
          { id: 'opening-a', role: 'CONCIERGE', content: 'Welcome to the event. How can I help you?' },
        ] });
      }),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);
    expect(await screen.findByText('Which language would you like to use for this chat?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Write a message…')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Chat language' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search languages' }), 'English');
    await user.click(screen.getByRole('option', { name: /English/ }));
    expect(await screen.findByText('Welcome to the event. How can I help you?')).toBeInTheDocument();
    expect(screen.queryByText('How can I help with your event?')).not.toBeInTheDocument();
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
          language: 'en',
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
      http.get(historyEndpoint, () => HttpResponse.json({ id: 'conversation-a', language: 'en', messages: [] })),
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
    await user.type(await screen.findByLabelText('Write a message…'), 'What starts next?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText('Concierge could not respond. Please try again.'),
    ).toBeInTheDocument();
  });

  it('starts a fresh guest chat without rendering the saved old messages and keeps its language', async () => {
    server.use(
      http.get(historyEndpoint, () => HttpResponse.json({ id: 'old-chat', language: 'sq', messages: [
        { id: 'old-message', role: 'CONCIERGE', content: 'Old answer' },
      ] })),
      http.post(chatsEndpoint, async ({ request }) => {
        expect(await request.json()).toEqual({ language: 'sq' });
        return HttpResponse.json({ id: 'new-chat', language: 'sq', messages: [
          { id: 'opening-sq', role: 'CONCIERGE', content: 'Si mund t’ju ndihmoj me këtë event?' },
        ] });
      }),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);
    expect(await screen.findByText('Old answer')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'New chat' }));
    await waitFor(() => expect(screen.queryByText('Old answer')).not.toBeInTheDocument());
    expect(screen.getByText('Si mund t’ju ndihmoj me këtë event?')).toBeInTheDocument();
    expect(screen.getByText(/Albanian/)).toBeInTheDocument();
    expect(screen.getByLabelText('Write a message…')).toBeInTheDocument();
  });

  it('updates the shown guest language when the guest changes it in chat', async () => {
    server.use(
      http.get(historyEndpoint, () => HttpResponse.json({ id: 'chat-a', language: 'en', messages: [] })),
      http.post(streamEndpoint, () => new HttpResponse([
        JSON.stringify({ type: 'language', language: 'fr' }),
        JSON.stringify({ type: 'message', message: {
          id: 'answer-a', role: 'CONCIERGE', content: 'Bien sûr, je continuerai en français.',
        } }),
      ].join('\n'), { headers: { 'Content-Type': 'application/x-ndjson' } })),
    );
    renderApp(<ConciergeWorkspace eventId="event-a" guest />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Write a message…'), 'Please continue in French.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Bien sûr, je continuerai en français.')).toBeInTheDocument();
    expect(screen.getByText(/^🇫🇷 French/)).toBeInTheDocument();
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
