import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { EventDetail } from '../../types/domain';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { DocumentsPage } from './DocumentsPage';

const event: EventDetail = {
  id: 'event-a',
  clientId: 'client-a',
  name: 'Leadership Forum',
  slug: 'leadership-forum',
  category: 'CONFERENCE',
  description: 'A fictional forum.',
  destination: 'Lisbon',
  venue: 'Riverside Hall',
  venueAddress: null,
  venueDetails: null,
  restroomInformation: null,
  accessibilityInformation: null,
  parkingInformation: null,
  wifiInformation: null,
  startAt: '2027-10-12T08:00:00Z',
  endAt: '2027-10-14T18:00:00Z',
  timezone: 'Europe/Lisbon',
  organizerName: 'Northstar',
  organizerEmail: 'events@example.test',
  status: 'READY',
  operationalStatus: 'UPCOMING',
  client: { id: 'client-a', name: 'Northstar' },
  createdBy: {
    id: 'user-a',
    firstName: 'Morgan',
    lastName: 'Reed',
    email: 'staff@example.test',
  },
  capabilities: { canEdit: true, canDelete: true, canCancel: true },
  completeness: { score: 100, ready: true, missing: [], warnings: [], recommendations: [] },
  _count: { guests: 0, documents: 0, invitations: 0 },
  schedule: [],
  facts: [],
};

function Harness() {
  return <Outlet context={{ event }} />;
}

describe('DocumentsPage', () => {
  it('uploads a selected event document when the actor has permission', async () => {
    const uploaded = vi.fn();
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
              permissions: ['EVENT_READ', 'DOCUMENT_UPLOAD'],
            },
          ],
        }),
      ),
      http.get('http://localhost:3000/api/v1/events/event-a/documents', () =>
        HttpResponse.json([]),
      ),
      http.post('http://localhost:3000/api/v1/events/event-a/documents', ({ request }) => {
        expect(request.headers.get('content-type')).toContain('multipart/form-data');
        uploaded();
        return HttpResponse.json({ id: 'document-a', processingStatus: 'QUEUED' });
      }),
    );
    const rendered = renderApp(
      <MemoryRouter>
        <Routes>
          <Route element={<Harness />}>
            <Route index element={<DocumentsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const input = rendered.container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await userEvent.upload(input as HTMLInputElement, new File(['agenda'], 'agenda.txt'));
    expect(
      await screen.findByText('Document uploaded and queued for processing.'),
    ).toBeInTheDocument();
    expect(uploaded).toHaveBeenCalledOnce();
  });
});
