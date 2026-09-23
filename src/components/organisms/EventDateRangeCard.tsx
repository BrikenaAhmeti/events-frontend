import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';
import { DateFilter, type DateFilterValue } from '../molecules/DateFilter';

type EventDates = {
  startAt: string;
  endAt: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
};

const partsInZone = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

export function localDateTimeToUtc(value: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0] = value.split(/[-T:]/).map(Number);
  const expected = Date.UTC(year, month - 1, day, hour, minute);
  let instant = expected;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const local = partsInZone(new Date(instant), timezone);
      const [localYear = 0, localMonth = 0, localDay = 0, localHour = 0, localMinute = 0] = local.split(/[-T:]/).map(Number);
      const actual = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute);
      instant += expected - actual;
    }
    return partsInZone(new Date(instant), timezone) === value
      ? new Date(instant).toISOString()
      : null;
  } catch {
    return null;
  }
}

const localValue = (value: string, timezone: string) => {
  if (!value) return '';
  try { return partsInZone(new Date(value), timezone); } catch { return ''; }
};

export function EventDateRangeCard({
  value, onSubmit, disabled = false,
}: {
  value: EventDates;
  onSubmit: (value: EventDates) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('events');
  const [timezone, setTimezone] = useState(value.timezone || '');
  const initialStart = localValue(value.startAt, timezone);
  const initialEnd = localValue(value.endAt, timezone);
  const [range, setRange] = useState<DateFilterValue>(() => ({
    date: '', from: value.startDate || initialStart.split('T')[0] || '',
    to: value.endDate || initialEnd.split('T')[0] || '',
  }));
  const [startHour, setStartHour] = useState(initialStart.split('T')[1]?.split(':')[0] || '');
  const [startMinute, setStartMinute] = useState(initialStart.split('T')[1]?.split(':')[1] || '');
  const [endHour, setEndHour] = useState(initialEnd.split('T')[1]?.split(':')[0] || '');
  const [endMinute, setEndMinute] = useState(initialEnd.split('T')[1]?.split(':')[1] || '');
  const [error, setError] = useState('');

  const submit = () => {
    const startAt = localDateTimeToUtc(`${range.from}T${startHour}:${startMinute}`, timezone);
    const endAt = localDateTimeToUtc(`${range.to}T${endHour}:${endMinute}`, timezone);
    if (!startAt || !endAt) {
      setError(t('dateRangeInvalid'));
      return;
    }
    if (endAt <= startAt) {
      setError(t('dateRangeOrder'));
      return;
    }
    setError('');
    onSubmit({ startAt, endAt, timezone });
  };

  return (
    <div className="space-y-3" aria-label={t('eventDateTimeRange')}>
      <p className="font-semibold">{t('eventDateTimeRange')}</p>
      <p className="text-sm text-muted-foreground">{t('eventDateTimeHelp')}</p>
      <DateFilter value={range} onChange={setRange} rangeOnly />
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { label: t('startDateTime'), hour: startHour, minute: startMinute,
            setHour: setStartHour, setMinute: setStartMinute, prefix: 'start' },
          { label: t('endDateTime'), hour: endHour, minute: endMinute,
            setHour: setEndHour, setMinute: setEndMinute, prefix: 'end' },
        ] as const).map(({ label, hour, minute, setHour, setMinute, prefix }) => (
          <div key={prefix} className="rounded-xl border border-border p-3">
            <p className="mb-2 text-xs font-semibold">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label={`${label} hour`}
                className="min-h-11 rounded-lg border border-input bg-surface px-3 text-sm"
                value={hour}
                onChange={(event) => setHour(event.target.value)}
                disabled={disabled}
              >
                <option value="">{t('hour')}</option>
                {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
                  .map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select
                aria-label={`${label} minute`}
                className="min-h-11 rounded-lg border border-input bg-surface px-3 text-sm"
                value={minute}
                onChange={(event) => setMinute(event.target.value)}
                disabled={disabled}
              >
                <option value="">{t('minute')}</option>
                {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
                  .map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
      <label className="block text-xs font-semibold" htmlFor="event-timezone">{t('eventTimezone')}</label>
      <input
        id="event-timezone"
        className="min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm"
        value={timezone}
        onChange={(event) => setTimezone(event.target.value)}
        placeholder="Europe/Rome"
        disabled={disabled}
      />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="button" onClick={submit} disabled={disabled}>{t('useEventDates')}</Button>
    </div>
  );
}
