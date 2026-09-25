import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import type { EventDetail } from '../../types/domain';
import { EventLayout } from './EventLayout';

it('shows Guests and Invitations tabs to staff viewing an event', async () => {
  server.use(
    http.get('http://localhost:3000/api/v1/auth/me', () => HttpResponse.json({
      userId: 'staff-b', email: 'staff@example.test', firstName: 'Other', lastName: 'Staff', platformRole: null,
      memberships: [{ clientId: 'client-a', role: 'CLIENT_STAFF', status: 'ACTIVE', permissions: ['EVENT_CREATE'] }],
    })),
    http.get('http://localhost:3000/api/v1/events/event-a', () => HttpResponse.json({
      id: 'event-a', clientId: 'client-a', name: 'Leadership Forum', category: 'CONFERENCE',
      status: 'READY', startAt: '2027-10-12T08:00:00Z', timezone: 'Europe/Lisbon',
      destination: 'Lisbon', createdBy: { id: 'staff-a', firstName: 'Morgan', lastName: 'Reed', email: 'creator@example.test' },
      completeness: { ready: true, score: 100, missing: [], warnings: [], recommendations: [] },
      capabilities: { canEdit: false, canDelete: false, canCancel: false },
    } satisfies Partial<EventDetail>)),
  );
  renderApp(<MemoryRouter initialEntries={['/app/events/event-a']}><Routes>
    <Route path="/app/events/:eventId" element={<EventLayout />}>
      <Route index element={<div>Overview</div>} />
    </Route>
  </Routes></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Guests' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Invitations' })).toBeInTheDocument();
});
