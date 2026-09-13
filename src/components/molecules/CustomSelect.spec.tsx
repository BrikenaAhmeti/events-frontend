import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CustomMultiSelect, CustomSelect } from './CustomSelect';

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

  it('supports selecting several filter values and clearing them', async () => {
    function MultiSelectExample() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <CustomMultiSelect
          label="Event status"
          placeholder="All statuses"
          value={value}
          options={[
            { value: 'READY', label: 'Ready' },
            { value: 'PUBLISHED', label: 'Published' },
          ]}
          onChange={setValue}
        />
      );
    }

    render(<MultiSelectExample />);

    await userEvent.click(screen.getByRole('button', { name: 'Event status' }));
    await userEvent.click(screen.getByRole('option', { name: 'Ready' }));
    await userEvent.click(screen.getByRole('option', { name: 'Published' }));

    expect(screen.getByRole('option', { name: 'Ready' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Published' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('option', { name: 'Ready' })).toHaveAttribute('aria-selected', 'false');
  });
});
