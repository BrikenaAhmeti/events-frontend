import clsx from 'clsx';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'narrow' });
const longDateFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const summaryFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

type PendingValue = { date: string; hour: string; minute: string };

export function DateTimePicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('events');
  const dialogId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingValue>(() => pendingFromValue(value));
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseDate(pendingFromValue(value).date) ?? new Date()),
  );
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        weekdayFormatter.format(new Date(2024, 0, 7 + index)),
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  const openPicker = () => {
    const next = pendingFromValue(value);
    setPending(next);
    setVisibleMonth(startOfMonth(parseDate(next.date) ?? new Date()));
    setOpen((current) => !current);
  };
  const summary = formatSummary(value) ?? t('chooseDateAndTime');

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-input bg-surface px-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 disabled:opacity-60"
        aria-label={label}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-expanded={open}
        disabled={disabled}
        onClick={openPicker}
      >
        <CalendarDays className="size-4.5 shrink-0 text-primary" />
        <span className={clsx('min-w-0 flex-1 truncate text-sm font-medium', !value && 'text-muted-foreground')}>
          {summary}
        </span>
        <ChevronDown
          className={clsx('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={label}
          className="absolute left-0 z-[80] mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface-raised p-4 shadow-[0_22px_60px_rgb(0_0_0/0.22)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('previousMonth')}
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-display text-lg">{monthFormatter.format(visibleMonth)}</p>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('nextMonth')}
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="py-1.5">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid">
            {days.map((day) => {
              const key = dateKey(day);
              const selected = key === pending.date;
              const today = key === dateKey(new Date());
              const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-label={longDateFormatter.format(day)}
                  aria-selected={selected}
                  className={clsx(
                    'relative grid aspect-square place-items-center rounded-xl text-sm transition hover:bg-muted',
                    outsideMonth && 'text-muted-foreground/45',
                    selected && 'bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90',
                  )}
                  onClick={() => setPending((current) => ({ ...current, date: key }))}
                >
                  {day.getDate()}
                  {today && !selected && (
                    <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl bg-surface-sunken p-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <Clock className="size-4" />
              {t('time')}
            </p>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <select
                className="min-h-11 rounded-lg border border-input bg-surface px-3 text-center text-sm font-semibold"
                aria-label={t('hour')}
                value={pending.hour}
                onChange={(event) =>
                  setPending((current) => ({ ...current, hour: event.target.value }))
                }
              >
                {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map(
                  (hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ),
                )}
              </select>
              <span className="font-bold text-muted-foreground">:</span>
              <select
                className="min-h-11 rounded-lg border border-input bg-surface px-3 text-center text-sm font-semibold"
                aria-label={t('minute')}
                value={pending.minute}
                onChange={(event) =>
                  setPending((current) => ({ ...current, minute: event.target.value }))
                }
              >
                {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map(
                  (minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={() => {
                  const now = new Date();
                  setPending({
                    date: dateKey(now),
                    hour: String(now.getHours()).padStart(2, '0'),
                    minute: String(now.getMinutes()).padStart(2, '0'),
                  });
                  setVisibleMonth(startOfMonth(now));
                }}
              >
                {t('today')}
              </Button>
              {value && (
                <Button
                  type="button"
                  size="sm"
                  variant="quiet"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  {t('clearDate')}
                </Button>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!pending.date}
              onClick={() => {
                onChange(`${pending.date}T${pending.hour}:${pending.minute}`);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {t('applyDateTime')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pendingFromValue(value: string): PendingValue {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (match) return { date: match[1]!, hour: match[2]!, minute: match[3]! };
  const now = new Date();
  return { date: dateKey(now), hour: '09', minute: '00' };
}

function formatSummary(value: string): string | null {
  const pending = pendingFromValue(value);
  if (!value) return null;
  const date = parseDate(pending.date);
  if (!date) return null;
  date.setHours(Number(pending.hour), Number(pending.minute), 0, 0);
  return summaryFormatter.format(date);
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function calendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from(
    { length: 42 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}
