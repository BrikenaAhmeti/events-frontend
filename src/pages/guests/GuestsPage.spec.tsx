import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { EventDetail } from '../../types/domain';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { GuestsPage } from './GuestsPage';

const event = {
  id: 'event-a',
  clientId: 'client-a',
  name: 'Leadership Forum',
  status: 'READY',
  capabilities: { canEdit: false, canManageGuests: true, canImportGuests: true },
} as EventDetail;

function Harness() {
  return <Outlet context={{ event }} />;
}

describe('GuestsPage import workflow', () => {
  it('previews deterministic mapping before confirming valid rows', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () =>
        HttpResponse.json({
          userId: 'user-a',
          email: 'staff@example.test',
          firstName: 'Morgan',
          lastName: 'Reed',
          platformRole: null,
          memberships: [
            {
              clientId: 'client-a',
              role: 'CLIENT_STAFF',
              status: 'ACTIVE',
              permissions: ['GUEST_READ', 'GUEST_IMPORT'],
            },
          ],
        }),
      ),
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () =>
        HttpResponse.json({ items: [], pageInfo: { hasNextPage: false, endCursor: null } }),
      ),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/preview', () =>
        HttpResponse.json({
          mapping: { Name: 'fullName', Email: 'email' },
          validRows: [{ fullName: 'Avery Stone', email: 'avery@example.test' }],
          invalidRows: [],
          duplicates: [],
          summary: { total: 1, valid: 1, invalid: 0, duplicates: 0 },
        }),
      ),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/confirm', () =>
        HttpResponse.json({ accepted: 1, duplicates: 0, rejected: 0 }),
      ),
    );
    const rendered = renderApp(
      <MemoryRouter>
        <Routes>
          <Route element={<Harness />}>
            <Route index element={<GuestsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const input = rendered.container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await userEvent.upload(
      input as HTMLInputElement,
      new File(['Name,Email\nAvery Stone,avery@example.test'], 'guests.csv', {
        type: 'text/csv',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Import preview' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByText('1 guests imported.')).toBeInTheDocument();
  });

  it('edits a guest through the event-scoped endpoint', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () =>
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
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () =>
        HttpResponse.json({
          items: [
            {
              id: 'guest-a',
              fullName: 'Avery Stone',
              email: 'avery@example.test',
              company: 'Northstar',
              jobTitle: null,
              guestGroup: 'Delegates',
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      ),
      http.patch('http://localhost:3000/api/v1/events/event-a/guests/guest-a', () =>
        HttpResponse.json({ id: 'guest-a', fullName: 'Avery Reed' }),
      ),
    );
    renderApp(
      <MemoryRouter>
        <Routes>
          <Route element={<Harness />}>
            <Route index element={<GuestsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Edit guest' }));
    const name = screen.getByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Avery Reed');
    await userEvent.click(screen.getByRole('button', { name: 'Save guest' }));
    expect(await screen.findByText('Guest updated.')).toBeInTheDocument();
  });
});
