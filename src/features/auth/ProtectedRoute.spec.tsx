import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { ProtectedRoute } from './ProtectedRoute';

describe('ProtectedRoute', () => {
  it('bootstraps a backend-authoritative session', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () =>
        HttpResponse.json({
          userId: 'user-a',
          email: 'staff@example.test',
          firstName: 'Theo',
          lastName: 'James',
          platformRole: null,
          memberships: [
            {
              clientId: 'client-a',
              role: 'CLIENT_STAFF',
              status: 'ACTIVE',
              permissions: ['EVENT_READ'],
            },
          ],
        }),
      ),
    );
    renderApp(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<h1>Protected workspace</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Protected workspace' })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () =>
        HttpResponse.json(
          {
            statusCode: 401,
            code: 'UNAUTHENTICATED',
            message: 'Authentication is required.',
            details: {},
            requestId: 'request-a',
          },
          { status: 401 },
        ),
      ),
    );
    renderApp(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<h1>Protected workspace</h1>} />
          </Route>
          <Route path="/login" element={<h1>Sign-in route</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Sign-in route' })).toBeInTheDocument();
  });
});
