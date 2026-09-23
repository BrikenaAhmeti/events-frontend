import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { GuestRowsCard } from './GuestRowsCard';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

describe('GuestRowsCard', () => {
  it('requires an email and sends each guest’s private details to the guest API', async () => {
    const submitted: unknown[] = [];
    server.use(http.post('http://localhost:3000/api/v1/events/event-a/guests', async ({ request }) => {
      submitted.push(await request.json());
      return HttpResponse.json({ id: 'guest-a' }, { status: 201 });
    }));
    renderApp(<GuestRowsCard eventId="event-a" onSaved={() => undefined} onPendingChange={() => undefined} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Guest name'), 'Alex Morgan');
    await user.type(screen.getByLabelText('Details for this guest (optional)'), 'Seat B12');
    await user.click(screen.getByRole('button', { name: 'Save guest' }));
    expect(submitted).toHaveLength(0);

    await user.type(screen.getByLabelText('Guest email (required)'), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: 'Save guest' }));
    expect(await screen.findByText('Guest saved')).toBeInTheDocument();
    expect(submitted).toEqual([{
      fullName: 'Alex Morgan', email: 'alex@example.com', notes: 'Seat B12',
    }]);
  });
});
