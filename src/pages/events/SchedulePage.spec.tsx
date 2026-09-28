import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import type { EventDetail } from '../../types/domain';
import { SchedulePage } from './SchedulePage';

const event = {
  id: 'event-a', timezone: 'Europe/Athens', capabilities: { canEdit: false, canEditSchedule: true },
  schedule: [{ id: 'item-a', title: 'Dinner', description: null, startAt: '2027-05-18T16:00:00.000Z',
    endAt: '2027-05-18T17:00:00.000Z', location: 'Hall', category: null, visibility: 'SHARED' }],
} as unknown as EventDetail;

describe('SchedulePage', () => {
  it('edits and deletes an item while schedule editing remains available during the event', async () => {
    let updated: Record<string, unknown> | undefined;
    let deleted = false;
    server.use(
      http.patch('http://localhost:3000/api/v1/events/event-a/schedule/item-a', async ({ request }) => {
        updated = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 'item-a' });
      }),
      http.delete('http://localhost:3000/api/v1/events/event-a/schedule/item-a', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp(<MemoryRouter><Routes><Route element={<Outlet context={{ event }} />}><Route index element={<SchedulePage />} /></Route></Routes></MemoryRouter>);

    await userEvent.click(screen.getByRole('button', { name: 'Edit schedule item' }));
    expect(screen.getByLabelText('Start date and time')).toHaveValue('2027-05-18T19:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule item' }));
    await waitFor(() => expect(updated?.startAt).toBe('2027-05-18T16:00:00.000Z'));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
