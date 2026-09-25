import { screen, waitFor, within } from '@testing-library/react';
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

function Harness({ eventValue = event }: { eventValue?: EventDetail }) {
  return <Outlet context={{ event: eventValue }} />;
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
    await userEvent.click(screen.getByRole('button', { name: 'Add guests only' }));
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

describe('GuestsPage invitations', () => {
  const publishedEvent = {
    ...event, status: 'PUBLISHED',
    capabilities: { ...event.capabilities, canSendInvitations: true, canManageGuests: true },
  } as EventDetail;

  it('shows the guest list read-only to staff who did not create the event', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'staff-b', email: 'other@example.test', firstName: 'Other', lastName: 'Staff', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_STAFF', status: 'ACTIVE', permissions: ['EVENT_CREATE'] }],
      })),
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () => HttpResponse.json({
        items: [{ id: 'guest-a', fullName: 'Avery Stone', email: 'avery@example.test', company: null, guestGroup: null }],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
    );
    const readOnlyEvent = { ...publishedEvent, capabilities: {
      ...publishedEvent.capabilities,
      canEdit: false, canManageGuests: false, canImportGuests: false, canSendInvitations: false,
    } } as EventDetail;
    renderApp(<MemoryRouter><Routes><Route element={<Harness eventValue={readOnlyEvent} />}><Route index element={<GuestsPage />} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByText('Avery Stone')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add guest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import guests' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send invitations' })).not.toBeInTheDocument();
  });

  it('imports edited rows and queues invitations only when that option is chosen', async () => {
    const imported = vi.fn(() => HttpResponse.json({ accepted: 1, duplicates: 0, guestIds: ['4e36fc71-5483-4d5a-b277-ff8d08f5a61c'] }));
    const sent = vi.fn(() => HttpResponse.json({ queued: 1 }));
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'user-a', email: 'staff@example.test', firstName: 'Morgan', lastName: 'Reed', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_STAFF', status: 'ACTIVE', permissions: ['EVENT_CREATE'] }],
      })),
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () => HttpResponse.json({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/preview', () => HttpResponse.json({
        mapping: { Name: 'fullName', Email: 'email' },
        rows: [{ row: 2, values: { Name: 'Avery Stone', Email: 'avery@example.test' }, data: { fullName: 'Avery Stone', email: 'avery@example.test' }, errors: [], duplicate: false }],
        validRows: [{ fullName: 'Avery Stone', email: 'avery@example.test' }], invalidRows: [], duplicates: [],
        summary: { total: 1, valid: 1, invalid: 0, duplicates: 0 },
      })),
      http.post('http://localhost:3000/api/v1/events/event-a/guests/imports/confirm', imported),
      http.post('http://localhost:3000/api/v1/events/event-a/invitations/send', sent),
    );
    const rendered = renderApp(<MemoryRouter><Routes><Route element={<Harness eventValue={publishedEvent} />}><Route index element={<GuestsPage />} /></Route></Routes></MemoryRouter>);
    const input = rendered.container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['Name,Email\nAvery Stone,avery@example.test'], 'guests.csv', { type: 'text/csv' }));
    await screen.findByRole('heading', { name: 'Import preview' });
    await userEvent.clear(screen.getByRole('textbox', { name: 'Full name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Full name' }), 'Avery Reed');
    await userEvent.click(screen.getByRole('button', { name: 'Add and send invitations' }));
    await waitFor(() => expect(sent).toHaveBeenCalledOnce());
    const body = (await (imported.mock.calls[0] as unknown as [{ request: Request }])[0].request.json()) as { rows: Array<{ fullName: string }> };
    expect(body.rows[0]?.fullName).toBe('Avery Reed');
  });

  it('offers a resend action for a sent guest invitation', async () => {
    const resend = vi.fn(() => HttpResponse.json({ queued: 1 }));
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'user-a', email: 'admin@example.test', firstName: 'Morgan', lastName: 'Reed', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] }],
      })),
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () => HttpResponse.json({
        items: [{ id: 'guest-a', fullName: 'Avery Stone', email: 'avery@example.test', company: null, guestGroup: null, latestInvitation: { id: 'inv-a', status: 'SENT', sentAt: null } }],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
      http.post('http://localhost:3000/api/v1/events/event-a/invitations/guests/guest-a/resend', resend),
    );
    renderApp(<MemoryRouter><Routes><Route element={<Harness eventValue={publishedEvent} />}><Route index element={<GuestsPage />} /></Route></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Resend invitation' }));
    await waitFor(() => expect(resend).toHaveBeenCalledOnce());
  });

  it('queues an invitation when a guest is added to a published event', async () => {
    let inviteBody: { guestIds?: string[] } | undefined;
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
        userId: 'user-a', email: 'admin@example.test', firstName: 'Morgan', lastName: 'Reed', platformRole: null,
        memberships: [{ clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] }],
      })),
      http.get('http://localhost:3000/api/v1/events/event-a/guests', () => HttpResponse.json({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      http.post('http://localhost:3000/api/v1/events/event-a/guests', () => HttpResponse.json({ id: 'guest-a' })),
      http.post('http://localhost:3000/api/v1/events/event-a/invitations/send', async ({ request }) => {
        inviteBody = await request.json() as { guestIds?: string[] };
        return HttpResponse.json({ queued: 1 });
      }),
    );
    renderApp(<MemoryRouter><Routes><Route element={<Harness eventValue={publishedEvent} />}><Route index element={<GuestsPage />} /></Route></Routes></MemoryRouter>);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: 'Add guest' }))[0]!);
    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Avery Stone');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'avery@example.test');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add guest' }));
    await waitFor(() => expect(inviteBody).toEqual({ guestIds: ['guest-a'] }));
  });
});
