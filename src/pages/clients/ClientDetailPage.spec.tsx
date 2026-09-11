import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { ClientDetailPage } from './ClientDetailPage';

const api = 'http://localhost:3000/api/v1';

describe('ClientDetailPage', () => {
  it('separates the client administrator from staff', async () => {
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
      http.get(`${api}/clients/client-a`, () =>
        HttpResponse.json({
          id: 'client-a',
          name: 'Northstar Events',
          slug: 'northstar-events',
          status: 'ACTIVE',
          contactEmail: 'hello@northstar.test',
          memberships: [
            {
              id: 'membership-admin',
              role: 'CLIENT_ADMIN',
              status: 'ACTIVE',
              user: {
                id: 'client-admin',
                firstName: 'Alex',
                lastName: 'Owner',
                email: 'alex@northstar.test',
              },
            },
            {
              id: 'membership-staff',
              role: 'CLIENT_STAFF',
              status: 'INVITED',
              user: {
                id: 'client-staff',
                firstName: 'Sam',
                lastName: 'Coordinator',
                email: 'sam@northstar.test',
              },
            },
          ],
          events: [],
        }),
      ),
    );

    renderApp(
      <MemoryRouter initialEntries={['/app/clients/client-a']}>
        <Routes>
          <Route path="/app/clients/:clientId" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const details = (await screen.findByRole('heading', { name: 'Client details' })).closest(
      'section',
    );
    const staff = screen.getByRole('heading', { name: 'Staff' }).closest('section');

    expect(details).not.toBeNull();
    expect(staff).not.toBeNull();
    expect(within(details!).getByText('Alex Owner')).toBeInTheDocument();
    expect(within(staff!).getByText('Sam Coordinator')).toBeInTheDocument();
    expect(within(staff!).queryByText('Alex Owner')).not.toBeInTheDocument();
  });
});
