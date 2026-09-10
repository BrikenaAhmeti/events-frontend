import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomSelect } from './CustomSelect';

describe('CustomSelect', () => {
  it('renders a custom listbox and returns the selected value', async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect
        label="Timing status"
        value=""
        options={[
          { value: '', label: 'All events' },
          { value: 'UPCOMING', label: 'Upcoming' },
        ]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Timing status' }));

    expect(screen.getByRole('listbox', { name: 'Timing status' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Upcoming' }));
    expect(onChange).toHaveBeenCalledWith('UPCOMING');
  });
});
