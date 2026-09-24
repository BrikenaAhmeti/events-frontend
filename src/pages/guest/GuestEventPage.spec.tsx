import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { GuestEventPage } from './GuestEventPage';
import { PublicEventPage } from './PublicEventPage';

describe('GuestEventPage', () => {
  it('shows the guest chat before the event begins when access is confirmed', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/guest/events/event-a', () => HttpResponse.json({
        id: 'event-a', name: 'Leadership Forum', category: 'CONFERENCE', description: 'A leadership forum',
        destination: 'Lisbon', venue: 'Riverside Hall', venueAddress: null, venueDetails: null,
        restroomInformation: null, accessibilityInformation: null, parkingInformation: null,
        wifiInformation: null, organizerName: 'Morgan Reed',
        startAt: new Date(Date.now() + 3_600_000).toISOString(),
        endAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
        accessClosesAt: new Date(Date.now() + 7 * 3_600_000).toISOString(),
        timezone: 'Europe/Lisbon', schedule: [],
      })),
      http.get('http://localhost:3000/api/v1/guest/events/event-a/concierge/messages', () => HttpResponse.json({ id: null, language: null, messages: [] })),
    );
    renderApp(<MemoryRouter initialEntries={['/guest/events/event-a']}><Routes><Route path="/guest/events/:eventId" element={<GuestEventPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Leadership Forum' })).toBeInTheDocument();
    expect(await screen.findByText('Which language would you like to use for this chat?')).toBeInTheDocument();
  });

  it('asks a guest opening a shared chat URL in a fresh browser to confirm their details', async () => {
    let accessBody: unknown;
    let identified = false;
    server.use(
      http.get('http://localhost:3000/api/v1/guest/events/event-a', () => identified
        ? HttpResponse.json({
          id: 'event-a', name: 'Leadership Forum', category: 'CONFERENCE', description: null,
          destination: 'Lisbon', venue: 'Riverside Hall', venueAddress: null, venueDetails: null,
          restroomInformation: null, accessibilityInformation: null, parkingInformation: null,
          wifiInformation: null, organizerName: 'Morgan Reed', startAt: '2027-10-12T08:00:00Z',
          endAt: '2027-10-14T18:00:00Z', timezone: 'Europe/Lisbon', schedule: [],
        })
        : HttpResponse.json({
          statusCode: 401, code: 'GUEST_SESSION_REQUIRED', message: 'Guest access is required.',
        }, { status: 401 })),
      http.get('http://localhost:3000/api/v1/public/event-links/event-a', () => HttpResponse.json({ slug: 'leadership-forum' })),
      http.get('http://localhost:3000/api/v1/public/events/leadership-forum', () => HttpResponse.json({
        id: 'event-a', slug: 'leadership-forum', name: 'Leadership Forum', category: 'CONFERENCE',
        description: 'A leadership event', destination: 'Lisbon', venue: 'Riverside Hall',
        startAt: '2027-10-12T08:00:00Z', endAt: '2027-10-14T18:00:00Z', timezone: 'Europe/Lisbon',
        accessState: 'ACTIVE',
      })),
      http.post('http://localhost:3000/api/v1/public/events/leadership-forum/access', async ({ request }) => {
        accessBody = await request.json();
        identified = true;
        return HttpResponse.json({ eventId: 'event-a' });
      }),
      http.get('http://localhost:3000/api/v1/guest/events/event-a/concierge/messages', () => HttpResponse.json({ id: null, language: null, messages: [] })),
    );
    renderApp(<MemoryRouter initialEntries={['/guest/events/event-a']}><Routes>
      <Route path="/guest/events/:eventId" element={<GuestEventPage />} />
      <Route path="/e/:slug" element={<PublicEventPage />} />
    </Routes></MemoryRouter>);

    await userEvent.type(await screen.findByLabelText('Your full name and email'), 'Avery Stone, avery@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Open Feliam' }));
    expect(await screen.findByText('Which language would you like to use for this chat?')).toBeInTheDocument();
    expect(accessBody).toEqual({ fullName: 'Avery Stone', email: 'avery@example.test' });
  });
});
