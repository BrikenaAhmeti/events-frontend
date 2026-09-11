import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { ClientsPage } from './ClientsPage';

const api = 'http://localhost:3000/api/v1';

describe('ClientsPage', () => {
  it('shows the staff count returned for each client', async () => {
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
      http.get(`${api}/clients`, () =>
        HttpResponse.json({
          items: [
            {
              id: 'client-a',
              name: 'Northstar Events',
              slug: 'northstar-events',
              status: 'ACTIVE',
              contactEmail: 'hello@northstar.test',
              _count: { events: 2, memberships: 4 },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      ),
    );

    renderApp(
      <MemoryRouter>
        <ClientsPage />
      </MemoryRouter>,
    );

    const client = await screen.findByRole('link', {
      name: /Northstar Events/,
    });
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(within(client).getByText('4')).toBeInTheDocument();
  });
});
