import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import type { EventSummary } from '../../types/domain';
import { EventsPage } from './EventsPage';

const api = 'http://localhost:3000/api/v1';
const event: EventSummary = {
  id: 'event-a',
  clientId: 'client-a',
  name: 'Leadership Forum',
  slug: 'leadership-forum',
  category: 'CONFERENCE',
  description: null,
  destination: 'Lisbon',
  venue: null,
  venueAddress: null,
  venueDetails: null,
  restroomInformation: null,
  accessibilityInformation: null,
  parkingInformation: null,
  wifiInformation: null,
  startAt: '2027-09-22T09:00:00.000Z',
  endAt: '2027-09-23T17:00:00.000Z',
  timezone: 'Europe/Lisbon',
  organizerName: null,
  organizerEmail: null,
  status: 'PUBLISHED',
  operationalStatus: 'UPCOMING',
  client: { id: 'client-a', name: 'Northstar Events' },
  createdBy: {
    id: 'user-a',
    firstName: 'Morgan',
    lastName: 'Reed',
    email: 'admin@example.test',
  },
  capabilities: { canEdit: true, canDelete: true, canCancel: true },
  completeness: {
    score: 70,
    ready: false,
    missing: [],
    warnings: [],
    recommendations: [],
  },
  _count: { guests: 0, documents: 0, invitations: 0 },
};

function renderPage() {
  server.use(
    http.get(`${api}/auth/me`, () =>
      HttpResponse.json({
        userId: 'user-a',
        email: 'admin@example.test',
        firstName: 'Morgan',
        lastName: 'Reed',
        platformRole: null,
        memberships: [
          {
            clientId: 'client-a',
            role: 'CLIENT_ADMIN',
            status: 'ACTIVE',
            permissions: [],
          },
        ],
      }),
    ),
    http.get(`${api}/events/directory/creators`, () => HttpResponse.json([])),
    http.get(`${api}/events`, () =>
      HttpResponse.json({
        items: [event],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    ),
  );

  return renderApp(
    <MemoryRouter initialEntries={['/app/events']}>
      <EventsPage />
    </MemoryRouter>,
  );
}

describe('EventsPage destructive actions', () => {
  it('asks for confirmation before cancelling an event', async () => {
    let cancelRequests = 0;
    server.use(
      http.post(`${api}/events/event-a/cancel`, () => {
        cancelRequests += 1;
        return HttpResponse.json({ ...event, status: 'CANCELLED' });
      }),
    );
    renderPage();

    const cancelButtons = await screen.findAllByRole('button', { name: 'Cancel event' });
    await userEvent.click(cancelButtons[0]!);

    expect(cancelRequests).toBe(0);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Event: Leadership Forum')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel event' }));
    await waitFor(() => expect(cancelRequests).toBe(1));
  });

  it('asks for confirmation before deleting an event', async () => {
    let deleteRequests = 0;
    server.use(
      http.delete(`${api}/events/event-a`, () => {
        deleteRequests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete event' });
    await userEvent.click(deleteButtons[0]!);

    expect(deleteRequests).toBe(0);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Event: Leadership Forum')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete event' }));
    await waitFor(() => expect(deleteRequests).toBe(1));
  });
});

describe('EventsPage event creation', () => {
  it('lets a platform administrator start creating an event before selecting a client filter', async () => {
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
      http.get(`${api}/events/directory/creators`, () => HttpResponse.json([])),
      http.get(`${api}/events`, () =>
        HttpResponse.json({
          items: [event],
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      ),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events']}>
        <EventsPage />
      </MemoryRouter>,
    );

    const createLink = await screen.findByRole('link', { name: 'Create event' });
    expect(createLink).toHaveAttribute('href', '/app/events/new');
  });
});

describe('EventsPage filters', () => {
  it('filters events by workflow status', async () => {
    let requestedStatus: string | null = null;
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'user-a',
          email: 'admin@example.test',
          firstName: 'Morgan',
          lastName: 'Reed',
          platformRole: null,
          memberships: [
            {
              clientId: 'client-a',
              role: 'CLIENT_ADMIN',
              status: 'ACTIVE',
              permissions: [],
            },
          ],
        }),
      ),
      http.get(`${api}/events/directory/creators`, () => HttpResponse.json([])),
      http.get(`${api}/events`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get('status');
        return HttpResponse.json({
          items: [event],
          pageInfo: { hasNextPage: false, endCursor: null },
        });
      }),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events']}>
        <EventsPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Event status' }));
    await userEvent.click(screen.getByRole('option', { name: 'Published' }));

    await waitFor(() => expect(requestedStatus).toBe('PUBLISHED'));
  });
});
