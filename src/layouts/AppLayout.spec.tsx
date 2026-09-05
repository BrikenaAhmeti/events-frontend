import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CurrentUser } from '../types/domain';
import { renderApp } from '../test/render';
import { server } from '../test/server';
import { AppLayout } from './AppLayout';

const baseUser: CurrentUser = {
  userId: 'user-a',
  email: 'operator@example.test',
  firstName: 'Morgan',
  lastName: 'Reed',
  platformRole: null,
  memberships: [],
};

const renderFor = (user: CurrentUser) => {
  server.use(http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json(user)));
  renderApp(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<h1>Workspace</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe('AppLayout role navigation', () => {
  it('shows platform administration to a super administrator', async () => {
    renderFor({ ...baseUser, platformRole: 'SUPER_ADMIN' });
    expect(await screen.findByRole('link', { name: 'Clients' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toBeInTheDocument();
  });

  it('shows all client operations to a client administrator', async () => {
    renderFor({
      ...baseUser,
      memberships: [
        {
          clientId: 'client-a',
          role: 'CLIENT_ADMIN',
          status: 'ACTIVE',
          permissions: [],
        },
      ],
    });
    expect(await screen.findByRole('link', { name: 'Events' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
  });

  it('hides operations absent from a staff permission set', async () => {
    renderFor({
      ...baseUser,
      memberships: [
        {
          clientId: 'client-a',
          role: 'CLIENT_STAFF',
          status: 'ACTIVE',
          permissions: ['EVENT_READ'],
        },
      ],
    });
    expect(await screen.findByRole('link', { name: 'Events' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
  });
});
