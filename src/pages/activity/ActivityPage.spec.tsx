import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { ActivityPage } from './ActivityPage';

const api = 'http://localhost:3000/api/v1';

const administrator = {
  userId: '2d341f45-e409-4e84-aa89-c621e25e7043',
  email: 'admin@example.test',
  firstName: 'Avery',
  lastName: 'Stone',
  platformRole: null,
  memberships: [
    {
      clientId: '041a6048-cd9a-47cd-8267-c6ac436ed70c',
      role: 'CLIENT_ADMIN',
      status: 'ACTIVE',
      permissions: [],
    },
  ],
};

function renderPage() {
  return renderApp(
    <MemoryRouter initialEntries={['/app/activity']}>
      <Routes>
        <Route path="/app/activity" element={<ActivityPage />} />
        <Route path="/app/forbidden" element={<h1>No access</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivityPage', () => {
  it('shows scoped activity and filters it by team member', async () => {
    let actorFilter: string | null = null;
    server.use(
      http.get(`${api}/auth/me`, () => HttpResponse.json(administrator)),
      http.get(`${api}/audit-logs/directory/clients`, () =>
        HttpResponse.json([
          {
            id: '041a6048-cd9a-47cd-8267-c6ac436ed70c',
            name: 'Northstar Events',
          },
        ]),
      ),
      http.get(`${api}/audit-logs/directory/actors`, () =>
        HttpResponse.json([
          {
            id: '4367d4d4-43e2-49ef-a882-ab0135640506',
            firstName: 'Jamie',
            lastName: 'Lee',
            role: 'CLIENT_STAFF',
          },
        ]),
      ),
      http.get(`${api}/audit-logs/directory/actions`, () => HttpResponse.json(['EVENT_UPDATED'])),
      http.get(`${api}/audit-logs`, ({ request }) => {
        actorFilter = new URL(request.url).searchParams.get('actorUserId');
        return HttpResponse.json({
          items: [
            {
              id: '7f723627-2245-4364-9b9f-c390a70c4a43',
              action: 'EVENT_UPDATED',
              entityType: 'Event',
              entityId: '2d04e112-b5ca-4a60-8528-906bfb084cf5',
              requestId: 'request-a',
              metadata: { fields: ['description'] },
              createdAt: '2026-09-18T09:30:00.000Z',
              actor: {
                id: '4367d4d4-43e2-49ef-a882-ab0135640506',
                firstName: 'Jamie',
                lastName: 'Lee',
                email: 'jamie@example.test',
                platformRole: null,
              },
              client: {
                id: '041a6048-cd9a-47cd-8267-c6ac436ed70c',
                name: 'Northstar Events',
              },
              event: {
                id: '2d04e112-b5ca-4a60-8528-906bfb084cf5',
                name: 'Leadership Forum',
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        });
      }),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Activity history' })).toBeInTheDocument();
    expect(await screen.findByText('Event Updated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leadership Forum' })).toHaveAttribute(
      'href',
      '/app/events/2d04e112-b5ca-4a60-8528-906bfb084cf5',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Team member' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Jamie Lee' }));
    await waitFor(() => expect(actorFilter).toBe('4367d4d4-43e2-49ef-a882-ab0135640506'));
  });

  it('identifies a super admin without showing their email address', async () => {
    server.use(
      http.get(`${api}/auth/me`, () => HttpResponse.json(administrator)),
      http.get(`${api}/audit-logs/directory/clients`, () => HttpResponse.json([])),
      http.get(`${api}/audit-logs/directory/actors`, () => HttpResponse.json([])),
      http.get(`${api}/audit-logs/directory/actions`, () => HttpResponse.json([])),
      http.get(`${api}/audit-logs`, () => HttpResponse.json({
        items: [{
          id: 'log-a', action: 'INVITATIONS_REQUESTED', entityType: 'Event', entityId: 'event-a',
          requestId: 'request-a', metadata: {}, createdAt: '2026-09-24T21:37:00.000Z',
          actor: { id: 'super-a', firstName: 'Mara', lastName: 'Ellis',
            email: null, platformRole: 'SUPER_ADMIN' },
          client: { id: 'client-a', name: 'Northstar Event' },
          event: { id: 'event-a', name: 'Global Leadership Forum' },
        }],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
    );

    renderPage();

    const actorRow = (await screen.findByText('Mara Ellis')).closest('article');
    expect(actorRow).toBeInTheDocument();
    expect(screen.getByText('Performed by')).toBeInTheDocument();
    expect(actorRow).toHaveTextContent('Super admin');
    expect(actorRow).not.toHaveTextContent('Team member');
    expect(screen.queryByText('super.admin@example.test')).not.toBeInTheDocument();
  });

  it('redirects client staff away from the administrator history', async () => {
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          ...administrator,
          memberships: [
            {
              ...administrator.memberships[0],
              role: 'CLIENT_STAFF',
              permissions: ['EVENT_READ'],
            },
          ],
        }),
      ),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
  });
});
