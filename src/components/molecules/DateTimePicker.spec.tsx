import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render';
import { DateTimePicker } from './DateTimePicker';

describe('DateTimePicker', () => {
  it('chooses a date and time without the browser-native date control', async () => {
    const onChange = vi.fn();
    renderApp(
      <DateTimePicker
        label="Start date and time"
        value="2027-10-12T08:30"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start date and time' }));
    await userEvent.click(screen.getByRole('gridcell', { name: 'Wednesday, October 13, 2027' }));
    await userEvent.selectOptions(screen.getByLabelText('Hour'), '14');
    await userEvent.selectOptions(screen.getByLabelText('Minute'), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Apply date and time' }));

    expect(onChange).toHaveBeenCalledWith('2027-10-13T14:45');
  });
});
