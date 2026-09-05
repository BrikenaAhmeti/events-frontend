import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { server } from '../../test/server';
import { renderApp } from '../../test/render';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('signs in through the backend and navigates without exposing tokens', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/auth/login', () =>
        HttpResponse.json({
          userId: 'user-a',
          email: 'admin@example.test',
          firstName: 'Elena',
          lastName: 'Hart',
          platformRole: null,
          memberships: [
            { clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] },
          ],
        }),
      ),
    );
    renderApp(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/dashboard" element={<h1>Workspace loaded</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Work email'), 'admin@example.test');
    await user.type(screen.getByLabelText('Password'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Workspace loaded' })).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
