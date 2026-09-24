import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { InvitationExchangePage } from './InvitationExchangePage';
import { PublicEventPage } from './PublicEventPage';

describe('guest entry links', () => {
  it('opens a personal email link automatically using only its opaque token', async () => {
    let exchangeBody: unknown;
    const preview = vi.fn(() => HttpResponse.json({}));
    server.use(
      http.post('http://localhost:3000/api/v1/public/invitations/preview', preview),
      http.post('http://localhost:3000/api/v1/public/invitations/exchange', async ({ request }) => {
        exchangeBody = await request.json();
        return HttpResponse.json({ eventId: 'event-a' });
      }),
    );
    renderApp(<MemoryRouter initialEntries={['/i/personal-token']}><Routes>
      <Route path="/i/:invitationToken" element={<InvitationExchangePage />} />
      <Route path="/guest/events/:eventId" element={<div>Guest chat opened</div>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('Guest chat opened')).toBeInTheDocument();
    expect(exchangeBody).toEqual({ token: 'personal-token' });
    expect(preview).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Your full name and email')).not.toBeInTheDocument();
  });

  it('still asks for name and email on an organizer shared event link', async () => {
    let accessBody: unknown;
    server.use(
      http.get('http://localhost:3000/api/v1/public/events/event-slug', () => HttpResponse.json({
        id: 'event-a', slug: 'event-slug', name: 'Leadership Forum', category: 'CONFERENCE',
        description: 'A leadership event', destination: 'Lisbon', venue: 'Riverside Hall',
        startAt: '2027-10-12T08:00:00Z', endAt: '2027-10-14T18:00:00Z', timezone: 'Europe/Lisbon',
        accessState: 'ACTIVE',
      })),
      http.post('http://localhost:3000/api/v1/public/events/event-slug/access', async ({ request }) => {
        accessBody = await request.json();
        return HttpResponse.json({ eventId: 'event-a' });
      }),
    );
    renderApp(<MemoryRouter initialEntries={['/e/event-slug']}><Routes>
      <Route path="/e/:slug" element={<PublicEventPage />} />
      <Route path="/guest/events/:eventId" element={<div>Guest chat opened</div>} />
    </Routes></MemoryRouter>);
    const identity = await screen.findByLabelText('Your full name and email');
    await userEvent.type(identity, 'Avery Stone, avery@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Open Feliam' }));
    await waitFor(() => expect(accessBody).toEqual({ fullName: 'Avery Stone', email: 'avery@example.test' }));
    expect(await screen.findByText('Guest chat opened')).toBeInTheDocument();
  });

  it('shows an unavailable message for an invalid personal token without asking for identity', async () => {
    server.use(
      http.post('http://localhost:3000/api/v1/public/invitations/exchange', () => HttpResponse.json({
        statusCode: 410, code: 'INVITATION_INVALID', message: 'This invitation is invalid.',
        details: {}, requestId: 'request-a',
      }, { status: 410 })),
    );
    renderApp(<MemoryRouter initialEntries={['/i/invalid-token']}><Routes>
      <Route path="/i/:invitationToken" element={<InvitationExchangePage />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Invitation unavailable' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your full name and email')).not.toBeInTheDocument();
  });
});
