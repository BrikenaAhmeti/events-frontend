import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { localDateTimeToUtc } from './EventDateRangeCard';
import { EventDateRangeCard } from './EventDateRangeCard';
import { renderApp } from '../../test/render';

describe('event date range conversion', () => {
  it('converts event-local dates and times to UTC without inventing missing times', () => {
    expect(localDateTimeToUtc('2026-09-22T09:00', 'Europe/Rome'))
      .toBe('2026-09-22T07:00:00.000Z');
    expect(localDateTimeToUtc('2026-09-23T18:00', 'Europe/Rome'))
      .toBe('2026-09-23T16:00:00.000Z');
    expect(localDateTimeToUtc('2026-09-22', 'Europe/Rome')).toBeNull();
    expect(localDateTimeToUtc('2026-09-22T09:00', 'Invalid/Timezone')).toBeNull();
  });

  it('submits the start, end, and timezone together from one chat card', async () => {
    const onSubmit = vi.fn();
    renderApp(<EventDateRangeCard
      value={{
        startAt: '2026-09-22T07:00:00.000Z',
        endAt: '2026-09-23T16:00:00.000Z',
        timezone: 'Europe/Rome',
      }}
      onSubmit={onSubmit}
    />);

    await userEvent.click(screen.getByRole('button', { name: 'Use these dates' }));

    expect(onSubmit).toHaveBeenCalledWith({
      startAt: '2026-09-22T07:00:00.000Z',
      endAt: '2026-09-23T16:00:00.000Z',
      timezone: 'Europe/Rome',
    });
  });

  it('keeps dates found in chat and requires the user to choose both times', async () => {
    const onSubmit = vi.fn();
    renderApp(<EventDateRangeCard
      value={{ startAt: '', endAt: '', startDate: '2026-09-22',
        endDate: '2026-09-23', timezone: 'Europe/Rome' }}
      onSubmit={onSubmit}
    />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose both dates and times');

    await user.selectOptions(screen.getByLabelText('Start date and time hour'), '09');
    await user.selectOptions(screen.getByLabelText('Start date and time minute'), '00');
    await user.selectOptions(screen.getByLabelText('End date and time hour'), '18');
    await user.selectOptions(screen.getByLabelText('End date and time minute'), '00');
    await user.click(screen.getByRole('button', { name: 'Use these dates' }));

    expect(onSubmit).toHaveBeenCalledWith({
      startAt: '2026-09-22T07:00:00.000Z',
      endAt: '2026-09-23T16:00:00.000Z',
      timezone: 'Europe/Rome',
    });
  });
});
