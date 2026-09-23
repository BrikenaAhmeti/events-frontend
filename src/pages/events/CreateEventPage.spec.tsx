import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { CreateEventPage } from './CreateEventPage';

const api = 'http://localhost:3000/api/v1';

describe('CreateEventPage platform administrator flow', () => {
  it('keeps setup usable when a successful response omits messages and draft', async () => {
    server.use(
      http.get(`${api}/auth/me`, () => HttpResponse.json({
        userId: 'platform-admin', email: 'platform@example.test',
        firstName: 'Platform', lastName: 'Admin', platformRole: 'SUPER_ADMIN', memberships: [],
      })),
      http.get(`${api}/events/directory/clients`, () => HttpResponse.json([
        { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
      ])),
      http.post(`${api}/events/setup/start`, () => HttpResponse.json({
        sessionId: 'setup-a', clientId: 'client-a', clientName: 'Northstar Events',
        resumed: false, message: 'Tell me about your event.',
      }, { status: 201 })),
    );

    renderApp(<MemoryRouter initialEntries={['/app/events/new']}><CreateEventPage /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByText('Tell me about your event.')).toBeInTheDocument();
    expect(screen.getByLabelText('Event information')).toBeEnabled();
    expect(screen.queryByText("Cannot read properties of undefined (reading 'map')")).not.toBeInTheDocument();
  });

  it('keeps a document-based event in chat until extracted details are confirmed', async () => {
    const readyEvent = {
      name: 'Leadership Forum', category: 'CONFERENCE',
      description: 'A leadership forum.', destination: 'Lisbon',
      startAt: '2027-10-12T08:00:00.000Z', endAt: '2027-10-12T18:00:00.000Z',
      timezone: 'Europe/Lisbon', organizerName: 'Morgan Reed',
      organizerEmail: 'morgan@example.test',
    };
    const texts: string[] = [];
    server.use(
      http.get(`${api}/auth/me`, () => HttpResponse.json({
        userId: 'platform-admin', email: 'platform@example.test',
        firstName: 'Platform', lastName: 'Admin', platformRole: 'SUPER_ADMIN', memberships: [],
      })),
      http.get(`${api}/events/directory/clients`, () => HttpResponse.json([
        { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
      ])),
      http.post(`${api}/events/setup/start`, () => HttpResponse.json({
        sessionId: 'setup-a', clientId: 'client-a', clientName: 'Northstar Events', resumed: true,
        messages: [
          { id: 'user-a', role: 'USER', content: 'Attached event file: different-layout.pdf' },
          { id: 'assistant-a', role: 'CONCIERGE', content: 'Current draft event details to confirm.' },
        ],
        draft: { event: readyEvent, facts: [], schedule: [], guests: [],
          suggestedName: 'Leadership Forum', nameWasProvided: true, documentReviewPending: true },
      })),
      http.post(`${api}/events/setup/analyze`, async ({ request }) => {
        const value = (await request.formData()).get('text');
        if (typeof value === 'string') texts.push(value);
        return HttpResponse.json({
          sessionId: 'setup-a', message: 'Thanks, I’ll use those confirmed details.',
          event: readyEvent, suggestedName: 'Leadership Forum', nameWasProvided: true,
          documentReviewPending: false, facts: [], schedule: [], guests: [],
          extractedFacts: 0, extractedScheduleItems: 0, file: null,
        });
      }),
    );

    renderApp(<MemoryRouter initialEntries={['/app/events/new']}><CreateEventPage /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm extracted details' });
    expect(screen.queryByRole('button', { name: 'Create event workspace' })).not.toBeInTheDocument();
    await userEvent.click(confirm);
    await waitFor(() => expect(texts).toEqual(['Confirm details']));
    expect(await screen.findByRole('button', { name: 'Create event workspace' })).toBeInTheDocument();
  });

  it('creates an event on behalf of the selected client', async () => {
    let createdEvent: Record<string, unknown> | undefined;
    const setupRequests: FormData[] = [];
    let releaseFirstResponse: (() => void) | undefined;
    const firstResponse = new Promise<void>((resolve) => {
      releaseFirstResponse = resolve;
    });
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        }),
      ),
      http.get(`${api}/events/directory/clients`, () =>
        HttpResponse.json([
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
        ]),
      ),
      http.post(`${api}/events/setup/start`, () =>
        HttpResponse.json({
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Describe the event or attach a file.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        }),
      ),
      http.post(`${api}/events/setup/analyze`, async ({ request }) => {
        setupRequests.push(await request.formData());
        if (setupRequests.length === 1) await firstResponse;
        return HttpResponse.json({
          message: 'I captured the location. What dates and organizer contact should I add?',
          sessionId: 'setup-a',
          event: {
            name: 'Leadership Forum',
            category: 'CONFERENCE',
            description: 'An annual leadership forum for company directors.',
            destination: 'Lisbon',
            startAt: '2027-10-12T08:00:00.000Z',
            endAt: '2027-10-12T18:00:00.000Z',
            timezone: 'Europe/Lisbon',
            organizerName: 'Morgan Reed',
            organizerEmail: 'morgan@example.test',
          },
          suggestedName: 'Leadership Forum',
          nameWasProvided: true,
          completeness: {
            score: 22,
            ready: true,
            missing: [],
            warnings: [],
            recommendations: [],
          },
          facts: [],
          schedule: [],
          extractedFacts: 0,
          extractedScheduleItems: 0,
          file: null,
        });
      }),
      http.post(`${api}/events`, async ({ request }) => {
        createdEvent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'event-new' });
      }),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <Routes>
          <Route path="/app/events/new" element={<CreateEventPage />} />
          <Route path="/app/events/:eventId/concierge" element={<p>Event created</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    const composer = screen.getByLabelText('Event information');
    expect(composer).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(composer).toBeEnabled());
    await userEvent.type(composer, 'A leadership forum in Lisbon.');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByText('A leadership forum in Lisbon.')).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Reviewing event information' }),
    ).toBeInTheDocument();
    releaseFirstResponse?.();
    expect(
      await screen.findByText(
        'I captured the location. What dates and organizer contact should I add?',
      ),
    ).toBeInTheDocument();
    expect(composer).toBeEnabled();
    expect(composer).toHaveValue('');
    await userEvent.type(composer, 'The organizer is Morgan Reed.');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(setupRequests).toHaveLength(2));
    expect(setupRequests[1]?.get('text')).toBe('The organizer is Morgan Reed.');
    expect(setupRequests[1]?.get('sessionId')).toBe('setup-a');
    await waitFor(() => expect(composer).toBeEnabled());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create event workspace' }),
    );

    await waitFor(() =>
      expect(createdEvent).toMatchObject({
        clientId: 'client-a',
        setupSessionId: 'setup-a',
        name: 'Leadership Forum',
        category: 'CONFERENCE',
        startAt: '2027-10-12T08:00:00.000Z',
        endAt: '2027-10-12T18:00:00.000Z',
      }),
    );
    expect(await screen.findByText('Event created')).toBeInTheDocument();
  });

  it('requires a fresh review when the administrator changes the selected client', async () => {
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        }),
      ),
      http.get(`${api}/events/directory/clients`, () =>
        HttpResponse.json([
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
          { id: 'client-b', name: 'Coastal Events', slug: 'coastal-events', status: 'ACTIVE' },
        ]),
      ),
      http.post(`${api}/events/setup/start`, async ({ request }) => {
        const body = (await request.json()) as { clientId: string };
        return HttpResponse.json({
          sessionId: `setup-${body.clientId}`,
          clientId: body.clientId,
          clientName: body.clientId === 'client-a' ? 'Northstar Events' : 'Coastal Events',
          resumed: false,
          messages: [
            {
              id: `welcome-${body.clientId}`,
              role: 'CONCIERGE',
              content: 'Describe the event or attach a file.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        });
      }),
      http.post(`${api}/events/setup/analyze`, () =>
        HttpResponse.json({
          sessionId: 'setup-client-a',
          event: {
            name: 'Leadership Forum',
            category: 'CONFERENCE',
            description: 'An annual leadership forum for company directors.',
            destination: 'Lisbon',
            startAt: '2027-10-12T08:00:00.000Z',
            endAt: '2027-10-12T18:00:00.000Z',
            timezone: 'Europe/Lisbon',
            organizerName: 'Morgan Reed',
            organizerEmail: 'morgan@example.test',
          },
          suggestedName: 'Leadership Forum',
          nameWasProvided: true,
          completeness: {
            score: 22,
            ready: true,
            missing: [],
            warnings: [],
            recommendations: [],
          },
          facts: [],
          schedule: [],
          extractedFacts: 0,
          extractedScheduleItems: 0,
          file: null,
        }),
      ),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <CreateEventPage />
      </MemoryRouter>,
    );

    const clientSelect = await screen.findByRole('button', { name: 'Client' });
    await userEvent.click(clientSelect);
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(screen.getByLabelText('Event information')).toBeEnabled());
    await userEvent.type(
      screen.getByLabelText('Event information'),
      'A leadership forum in Lisbon.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(
      await screen.findByRole('button', { name: 'Create event workspace' }),
    ).toBeInTheDocument();

    await userEvent.click(clientSelect);
    await userEvent.click(screen.getByRole('option', { name: 'Coastal Events' }));

    expect(
      screen.queryByRole('button', { name: 'Create event workspace' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Event information')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('resumes an unfinished setup and can archive it by starting a new chat', async () => {
    let starts = 0;
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        }),
      ),
      http.get(`${api}/events/directory/clients`, () =>
        HttpResponse.json([
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
        ]),
      ),
      http.post(`${api}/events/setup/start`, async ({ request }) => {
        starts += 1;
        const body = (await request.json()) as { restart?: boolean };
        if (starts === 1) {
          expect(body.restart).toBe(false);
          return HttpResponse.json({
            sessionId: 'setup-old',
            clientId: 'client-a',
            clientName: 'Northstar Events',
            resumed: true,
            messages: [
              { id: 'welcome-old', role: 'CONCIERGE', content: 'Welcome back.' },
              { id: 'user-old', role: 'USER', content: 'This is an unfinished conference.' },
            ],
            draft: {
              event: {
                name: 'Unfinished Conference',
                category: 'CONFERENCE',
                description: 'An unfinished conference setup.',
              },
              facts: [],
              schedule: [],
              suggestedName: 'Unfinished Conference',
              nameWasProvided: true,
            },
          });
        }
        expect(body.restart).toBe(true);
        return HttpResponse.json({
          sessionId: 'setup-new',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            { id: 'welcome-new', role: 'CONCIERGE', content: 'Starting a fresh event setup.' },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        });
      }),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('This is an unfinished conference.')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Add the event start and end dates, times, and timezone…')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }));

    expect(await screen.findByText('Starting a fresh event setup.')).toBeInTheDocument();
    expect(screen.queryByText('This is an unfinished conference.')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add the event start and end dates, times, and timezone…')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Event information')).toBeEnabled();
  });

  it('offers a fillable brief when the client chooses the file workflow', async () => {
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        }),
      ),
      http.get(`${api}/events/directory/clients`, () =>
        HttpResponse.json([
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
        ]),
      ),
      http.post(`${api}/events/setup/start`, () =>
        HttpResponse.json({
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Tell me what you know about the event. You can add guests here too.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        }),
      ),
      http.post(`${api}/events/setup/analyze`, () =>
        HttpResponse.json({
          sessionId: 'setup-a',
          message: 'Download the event brief template below.',
          event: {},
          suggestedName: '',
          nameWasProvided: false,
          completeness: {
            score: 0,
            ready: false,
            missing: ['name'],
            warnings: [],
            recommendations: [],
          },
          facts: [],
          schedule: [],
          extractedFacts: 0,
          extractedScheduleItems: 0,
          file: null,
          template: { kind: 'EVENT_BRIEF', fileName: 'feliam-event-brief-template.docx' },
        }),
      ),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.queryByRole('button', { name: /Guide me step by step/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Event information'), 'template');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Fillable event brief')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download Word document template' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download Excel workbook template' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Plain text template' })).toBeInTheDocument();
  });

  it('accepts event dates as another message in the setup conversation', async () => {
    const setupRequests: FormData[] = [];
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        }),
      ),
      http.get(`${api}/events/directory/clients`, () =>
        HttpResponse.json([
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar-events', status: 'ACTIVE' },
        ]),
      ),
      http.post(`${api}/events/setup/start`, () =>
        HttpResponse.json({
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Start with the event name, description, and type.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        }),
      ),
      http.post(`${api}/events/setup/analyze`, async ({ request }) => {
        setupRequests.push(await request.formData());
        return HttpResponse.json({
          sessionId: 'setup-a',
          message:
            setupRequests.length === 1
              ? 'What are the start and end dates and times, and which timezone should I use?'
              : 'Now add the location.',
          event: {
            name: 'Leadership Forum',
            category: 'CONFERENCE',
            description: 'An annual leadership forum for company directors.',
          },
          suggestedName: 'Leadership Forum',
          nameWasProvided: true,
          completeness: {
            score: 33,
            ready: false,
            missing: ['location', 'startAt', 'endAt', 'timezone', 'organizerName', 'organizerEmail'],
            warnings: [],
            recommendations: [],
          },
          facts: [],
          schedule: [],
          extractedFacts: 0,
          extractedScheduleItems: 0,
          file: null,
        });
      }),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Client' }));
    await userEvent.click(screen.getByRole('option', { name: 'Northstar Events' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    const composer = screen.getByLabelText('Event information');
    await userEvent.type(
      composer,
      'Leadership Forum, Annual gathering for regional directors, Conference',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('What are the start and end dates and times, and which timezone should I use?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Live event brief')).not.toBeInTheDocument();

    await userEvent.type(composer, 'October 12, 2027 at 9 AM to October 12, 2027 at 6 PM, Europe/Lisbon');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(setupRequests).toHaveLength(2));
    expect(setupRequests[1]?.get('text')).toBe('October 12, 2027 at 9 AM to October 12, 2027 at 6 PM, Europe/Lisbon');
  });
});
