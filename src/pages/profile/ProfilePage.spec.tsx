import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../../test/server';
import { renderApp } from '../../test/render';
import { ProfilePage } from './ProfilePage';

const api = 'http://localhost:3000/api/v1';
const currentUser = {
  userId: 'user-a',
  email: 'elena@example.test',
  firstName: 'Elena',
  lastName: 'Hart',
  platformRole: null,
  memberships: [
    {
      clientId: 'client-a',
      role: 'CLIENT_ADMIN',
      status: 'ACTIVE',
      permissions: [],
    },
  ],
};

describe('ProfilePage', () => {
  it('lets an authenticated platform user update profile details and password', async () => {
    server.use(
      http.get(`${api}/auth/me`, () => HttpResponse.json(currentUser)),
      http.patch(`${api}/auth/profile`, async ({ request }) =>
        HttpResponse.json({ ...currentUser, ...((await request.json()) as object) }),
      ),
      http.post(`${api}/auth/change-password`, () => new HttpResponse(null, { status: 204 })),
    );
    renderApp(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    const firstName = await screen.findByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Eleni');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Current password'), 'current-password');
    await user.type(screen.getByLabelText('New password'), 'new-secure-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'new-secure-password');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Password updated.')).toBeInTheDocument();
  });
});
