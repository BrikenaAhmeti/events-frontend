import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import type { EventDetail } from '../../types/domain';
import { EventOverviewPage } from './EventOverviewPage';

const event = {
  id: 'event-a', clientId: 'client-a', name: 'Leadership Forum', status: 'READY',
  description: 'A leadership forum', destination: 'Lisbon', venue: 'Riverside Hall',
  startAt: '2027-10-12T08:00:00Z', endAt: '2027-10-14T18:00:00Z', timezone: 'Europe/Lisbon',
  organizerName: 'Morgan Reed', organizerEmail: 'morgan@example.test',
  facts: [], schedule: [], completeness: { ready: true, score: 100, missing: [], warnings: [], recommendations: [] },
  capabilities: { canEdit: true, canPublish: true },
} as unknown as EventDetail;

describe('EventOverviewPage publishing', () => {
  it('requires an invitation choice before publishing and supports sending later', async () => {
    let publishBody: { sendInvitations?: boolean } | undefined;
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'user-a', email: 'admin@example.test', firstName: 'Morgan', lastName: 'Reed', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] }],
      })),
      http.post('http://localhost:3000/api/v1/events/event-a/publish', async ({ request }) => {
        publishBody = await request.json() as { sendInvitations?: boolean };
        return HttpResponse.json({ ...event, status: 'PUBLISHED' });
      }),
    );
    renderApp(<MemoryRouter><Routes><Route element={<Outlet context={{ event }} />}><Route index element={<EventOverviewPage />} /></Route><Route path="/app/events/:eventId/concierge" element={<div>Published</div>} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish event' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Publish event' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Publish now; send invitations later' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish event' }));
    await waitFor(() => expect(publishBody).toEqual({ sendInvitations: false }));
  });
});

describe('EventOverviewPage editing', () => {
  it('opens the edit form from a direct edit link', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'user-a', email: 'admin@example.test', firstName: 'Morgan', lastName: 'Reed', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] }],
      })),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/event-a?edit=1']}>
        <Routes>
          <Route path="/app/events/:eventId" element={<Outlet context={{ event }} />}>
            <Route index element={<EventOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('textbox', { name: 'Description and purpose' })).toHaveValue('A leadership forum');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('textbox', { name: 'Description and purpose' })).not.toBeInTheDocument();
  });

  it('does not open editing for staff viewing another creator’s event', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'staff-a', email: 'staff@example.test', firstName: 'Alex', lastName: 'Staff', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_STAFF', status: 'ACTIVE', permissions: ['EVENT_EDIT'] }],
      })),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/events/event-a?edit=1']}>
        <Routes>
          <Route path="/app/events/:eventId" element={<Outlet context={{ event: {
            ...event,
            capabilities: { ...event.capabilities, canEdit: false, canPublish: false },
          } }} />}>
            <Route index element={<EventOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A leadership forum')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Description and purpose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit event' })).not.toBeInTheDocument();
  });
});
