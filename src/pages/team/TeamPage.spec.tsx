import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { TeamPage } from './TeamPage';

const api = 'http://localhost:3000/api/v1';

describe('TeamPage staff lifecycle', () => {
  it('reenables staff directly and removes staff after confirmation', async () => {
    let enabled = false;
    let removed = false;
    server.use(
      http.get(`${api}/auth/me`, () =>
        HttpResponse.json({
          userId: 'admin-a',
          email: 'admin@example.test',
          firstName: 'Client',
          lastName: 'Admin',
          platformRole: null,
          memberships: [
            {
              id: 'admin-membership',
              clientId: 'client-a',
              role: 'CLIENT_ADMIN',
              status: 'ACTIVE',
              permissions: [],
            },
          ],
        }),
      ),
      http.get(`${api}/clients/client-a/team`, () =>
        HttpResponse.json([
          {
            id: 'membership-a',
            role: 'CLIENT_STAFF',
            status: 'DISABLED',
            invitedAt: '2026-09-01T08:00:00.000Z',
            joinedAt: '2026-09-02T08:00:00.000Z',
            user: {
              id: 'staff-a',
              email: 'staff@example.test',
              firstName: 'Staff',
              lastName: 'Member',
            },
            permissions: [],
          },
        ]),
      ),
      http.patch(`${api}/clients/client-a/team/membership-a`, async ({ request }) => {
        enabled = ((await request.json()) as { status?: string }).status === 'ACTIVE';
        return HttpResponse.json({ id: 'membership-a', status: 'ACTIVE' });
      }),
      http.delete(`${api}/clients/client-a/team/membership-a`, () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/team?clientId=client-a']}>
        <Routes>
          <Route path="/app/team" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Staff Member')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enable member' }));
    await waitFor(() => expect(enabled).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove team member?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(removed).toBe(true));
  });
});
