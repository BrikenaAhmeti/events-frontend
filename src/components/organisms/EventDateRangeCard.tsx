import { CalendarDays, Check, Globe2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';
import { DateFilter, type DateFilterValue } from '../molecules/DateFilter';
import { CustomSelect } from '../molecules/CustomSelect';
import { normalizeTime, TimePicker } from '../molecules/TimePicker';

type EventDates = {
  startAt: string;
  endAt: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
};

const partsInZone = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
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
      const [localYear = 0, localMonth = 0, localDay = 0, localHour = 0, localMinute = 0] = local
        .split(/[-T:]/)
        .map(Number);
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
  try {
    return partsInZone(new Date(value), timezone);
  } catch {
    return '';
  }
};

export function EventDateRangeCard({
  value,
  onSubmit,
  disabled = false,
}: {
  value: EventDates;
  onSubmit: (value: EventDates) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('events');
  const timezoneId = useId();
  const [timezone, setTimezone] = useState(value.timezone || '');
  const initialStart = localValue(value.startAt, timezone);
  const initialEnd = localValue(value.endAt, timezone);
  const [range, setRange] = useState<DateFilterValue>(() => {
    const from = value.startDate || initialStart.split('T')[0] || '';
    const to = value.endDate || initialEnd.split('T')[0] || '';
    return from && (!to || from === to) ? { date: from, from: '', to: '' } : { date: '', from, to };
  });
  const [startTime, setStartTime] = useState(initialStart.split('T')[1] || '');
  const [endTime, setEndTime] = useState(initialEnd.split('T')[1] || '');
  const [error, setError] = useState('');
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  let today: string;
  try {
    today = partsInZone(now, timezone || localTimezone).slice(0, 10);
  } catch {
    today = partsInZone(now, localTimezone).slice(0, 10);
  }
  const timezoneOptions = useMemo(() => {
    const supported =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : ['Europe/London', 'Europe/Rome', 'Europe/Tirane', 'America/New_York'];
    return [...new Set(['UTC', ...supported, localTimezone, timezone].filter(Boolean))]
      .sort()
      .map((zone) => ({
        value: zone,
        label: zone.replaceAll('_', ' ').replaceAll('/', ' / '),
      }));
  }, [localTimezone, timezone]);
  const from = range.date || range.from;
  const to = range.date || range.to;
  const startAt = localDateTimeToUtc(`${from}T${normalizeTime(startTime) ?? ''}`, timezone);
  const endAt = localDateTimeToUtc(`${to}T${normalizeTime(endTime) ?? ''}`, timezone);
  const startInPast = Boolean(startAt && Date.parse(startAt) <= now.getTime());
  const ready = Boolean(startAt && endAt && endAt > startAt && !startInPast);
  const duration = ready ? Math.round((Date.parse(endAt!) - Date.parse(startAt!)) / 60_000) : 0;
  const durationText = [
    Math.floor(duration / 1_440) ? t('durationDays', { count: Math.floor(duration / 1_440) }) : '',
    Math.floor((duration % 1_440) / 60)
      ? t('durationHours', { count: Math.floor((duration % 1_440) / 60) })
      : '',
    duration % 60 ? t('durationMinutes', { count: duration % 60 }) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const shortDate = (date: string) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));

  const submit = () => {
    if (!startAt || !endAt) {
      setError(t('dateRangeInvalid'));
      return;
    }
    if (endAt <= startAt) {
      setError(t('dateRangeOrder'));
      return;
    }
    if (Date.parse(startAt) <= Date.now()) {
      setError(t('eventStartMustBeFuture'));
      return;
    }
    setError('');
    onSubmit({ startAt, endAt, timezone });
  };

  return (
    <div className="space-y-5" aria-label={t('eventDateTimeRange')}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-xl leading-7">{t('eventDateTimeRange')}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('eventDateTimeHelp')}</p>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">{t('eventDates')}</p>
        <DateFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setError('');
          }}
          label={t('eventDates')}
          emptyLabel={t('chooseDayOrRange')}
          disabled={disabled}
          minDate={today}
        />
      </div>
      <div>
        <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
          {[
            {
              label: t('eventStartTime'),
              time: startTime,
              update: setStartTime,
            },
            { label: t('eventEndTime'), time: endTime, update: setEndTime },
          ].map(({ label, time, update }) => (
            <div key={label}>
              <p className="mb-2 text-sm font-semibold">{label}</p>
              <TimePicker
                label={label}
                value={time}
                onChange={(next) => {
                  update(next);
                  setError('');
                }}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('eventTimeHelp')}</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor={timezoneId}>
          {t('eventTimezone')}
        </label>
        <CustomSelect
          id={timezoneId}
          label={t('eventTimezone')}
          icon={Globe2}
          value={timezone}
          options={[{ value: '', label: t('chooseEventTimezone') }, ...timezoneOptions]}
          onChange={(next) => {
            setTimezone(next);
            setError('');
          }}
          disabled={disabled}
          searchable
          searchPlaceholder={t('searchTimezone')}
          noResultsText={t('noTimezoneMatches')}
        />
        {localTimezone !== timezone && (
          <button
            type="button"
            disabled={disabled}
            className="mt-2 min-h-9 text-left text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4 disabled:opacity-50"
            onClick={() => {
              setTimezone(localTimezone);
              setError('');
            }}
          >
            {t('useMyTimezone', {
              timezone: localTimezone.replaceAll('_', ' '),
            })}
          </button>
        )}
      </div>
      {ready && (
        <div
          role="status"
          className="rounded-xl border border-primary/15 bg-primary/5 p-3.5 text-sm"
        >
          <p className="font-semibold">
            {shortDate(from)}
            {from !== to ? ` – ${shortDate(to)}` : ''}
          </p>
          <p className="mt-1 tabular-nums">
            {normalizeTime(startTime)} – {normalizeTime(endTime)}{' '}
            <span className="text-muted-foreground">· {durationText}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{timezone.replaceAll('_', ' ')}</p>
        </div>
      )}
      {(error || startInPast) && (
        <p role="alert" className="text-sm text-danger">
          {error || t('eventStartMustBeFuture')}
        </p>
      )}
      <Button className="w-full sm:w-auto" type="button" onClick={submit} disabled={disabled}>
        <Check className="size-4" aria-hidden />
        {t('useEventDates')}
      </Button>
    </div>
  );
}
