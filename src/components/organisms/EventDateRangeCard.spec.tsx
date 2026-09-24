import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { localDateTimeToUtc } from './EventDateRangeCard';
import { EventDateRangeCard } from './EventDateRangeCard';
import { renderApp } from '../../test/render';

describe('event date range conversion', () => {
  it('rejects a start time in the past even when the end is later', async () => {
    const onSubmit = vi.fn();
    const startAt = new Date(Date.now() - 3_600_000).toISOString();
    const endAt = new Date(Date.now() + 3_600_000).toISOString();
    renderApp(<EventDateRangeCard value={{ startAt, endAt, timezone: 'UTC' }} onSubmit={onSubmit} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a future start date and time');
    await userEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('converts event-local dates and times to UTC without inventing missing times', () => {
    expect(localDateTimeToUtc('2026-09-22T09:00', 'Europe/Rome')).toBe('2026-09-22T07:00:00.000Z');
    expect(localDateTimeToUtc('2026-09-23T18:00', 'Europe/Rome')).toBe('2026-09-23T16:00:00.000Z');
    expect(localDateTimeToUtc('2026-09-22', 'Europe/Rome')).toBeNull();
    expect(localDateTimeToUtc('2026-09-22T09:00', 'Invalid/Timezone')).toBeNull();
    expect(localDateTimeToUtc('2027-03-28T02:30', 'Europe/Rome')).toBeNull();
  });

  it('submits the start, end, and timezone together from one chat card', async () => {
    const onSubmit = vi.fn();
    renderApp(
      <EventDateRangeCard
        value={{
          startAt: '2030-09-22T07:00:00.000Z',
          endAt: '2030-09-23T16:00:00.000Z',
          timezone: 'Europe/Rome',
        }}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use these dates' }));

    expect(onSubmit).toHaveBeenCalledWith({
      startAt: '2030-09-22T07:00:00.000Z',
      endAt: '2030-09-23T16:00:00.000Z',
      timezone: 'Europe/Rome',
    });
  });

  it('keeps dates found in chat and requires the user to choose both times', async () => {
    const onSubmit = vi.fn();
    renderApp(
      <EventDateRangeCard
        value={{
          startAt: '',
          endAt: '',
          startDate: '2030-09-22',
          endDate: '2030-09-23',
          timezone: 'Europe/Rome',
        }}
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the date or range, both times');

    await user.type(screen.getByLabelText('Start time'), '09:00');
    await user.click(screen.getByRole('button', { name: 'Choose End time' }));
    await user.click(screen.getByRole('option', { name: '18:00' }));
    await user.click(screen.getByRole('button', { name: 'Use these dates' }));

    expect(onSubmit).toHaveBeenCalledWith({
      startAt: '2030-09-22T07:00:00.000Z',
      endAt: '2030-09-23T16:00:00.000Z',
      timezone: 'Europe/Rome',
    });
  });

  it('uses one date for both times, allows exact minutes and searches timezones', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderApp(
      <EventDateRangeCard
        value={{
          startAt: '',
          endAt: '',
          startDate: '2027-10-12',
          timezone: '',
        }}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText('Start time'), '0915');
    await user.type(screen.getByLabelText('End time'), '1745');
    await user.click(screen.getByRole('button', { name: 'Event timezone' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search city or timezone' }), 'New York');
    await user.click(screen.getByRole('option', { name: 'America / New York' }));
    expect(screen.getByRole('status')).toHaveTextContent('8h 30m');
    await user.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(onSubmit).toHaveBeenCalledWith({
      startAt: '2027-10-12T13:15:00.000Z',
      endAt: '2027-10-12T21:45:00.000Z',
      timezone: 'America/New_York',
    });
  });

  it('prevents an end time before the start on a single day', async () => {
    const onSubmit = vi.fn();
    renderApp(
      <EventDateRangeCard
        value={{
          startAt: '',
          endAt: '',
          startDate: '2027-10-12',
          timezone: 'UTC',
        }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.type(screen.getByLabelText('Start time'), '18:00');
    await userEvent.type(screen.getByLabelText('End time'), '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
