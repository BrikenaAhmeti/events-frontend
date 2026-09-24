import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render';
import { GuestConfirmation } from './GuestConfirmation';

describe('GuestConfirmation', () => {
  it('confirms name and normalized email together and rejects incomplete messages', async () => {
    const confirm = vi.fn();
    renderApp(<GuestConfirmation onConfirm={confirm} pending={false} error={false} />);
    const input = screen.getByLabelText('Your full name and email');
    await userEvent.type(input, 'avery@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Open Feliam' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your full name and one valid email address, separated by a comma.')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, 'Avery Stone, AVERY@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Open Feliam' }));
    expect(confirm).toHaveBeenCalledWith({ fullName: 'Avery Stone', email: 'avery@example.test' });
  });
});
