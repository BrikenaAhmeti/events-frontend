import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { GuestEventPage } from './GuestEventPage';

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
      http.get('http://localhost:3000/api/v1/guest/events/event-a/concierge/messages', () => HttpResponse.json({ messages: [] })),
    );
    renderApp(<MemoryRouter initialEntries={['/guest/events/event-a']}><Routes><Route path="/guest/events/:eventId" element={<GuestEventPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Leadership Forum' })).toBeInTheDocument();
    expect(screen.getByLabelText('Write a message…')).toBeInTheDocument();
  });
});
