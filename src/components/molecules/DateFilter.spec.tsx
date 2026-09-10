import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderApp } from '../../test/render';
import { DateFilter, type DateFilterValue } from './DateFilter';

function Harness() {
  const [value, setValue] = useState<DateFilterValue>({
    date: '2027-09-22',
    from: '',
    to: '',
  });
  return <DateFilter value={value} onChange={setValue} />;
}

describe('DateFilter', () => {
  it('selects one date from the custom calendar', async () => {
    renderApp(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Date filter: Sep 22, 2027' }));
    await userEvent.click(screen.getByRole('gridcell', { name: 'Friday, September 24, 2027' }));

    expect(
      screen.getByRole('button', { name: 'Date filter: Sep 24, 2027' }),
    ).toBeInTheDocument();
  });

  it('selects a complete range in the same filter', async () => {
    renderApp(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Date filter: Sep 22, 2027' }));
    await userEvent.click(screen.getByRole('button', { name: 'Date range' }));
    await userEvent.click(screen.getByRole('gridcell', { name: 'Thursday, September 23, 2027' }));

    expect(
      screen.getByRole('button', {
        name: 'Date filter: Sep 22, 2027 – Sep 23, 2027',
      }),
    ).toBeInTheDocument();
  });
});
