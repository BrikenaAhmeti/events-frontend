import clsx from 'clsx';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePopoverPosition } from '../../lib/use-popover-position';

export type DateFilterValue = {
  date: string;
  from: string;
  to: string;
};

type DateMode = 'single' | 'range';

const monthFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
});
const shortFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const longFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'narrow' });

export function DateFilter({
  value,
  onChange,
  className,
  initialMode,
  rangeOnly = false,
  label,
  emptyLabel,
  disabled = false,
}: {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  className?: string;
  initialMode?: DateMode;
  rangeOnly?: boolean;
  label?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation('events');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>(() =>
    rangeOnly ? 'range' : (initialMode ?? (value.from || value.to ? 'range' : 'single')),
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseDate(value.date || value.from) ?? new Date()),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const position = usePopoverPosition(open, triggerRef, 336, 520, 360, true);
  const accessibleLabel = label ?? t('dateFilter');

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"], button')
        ?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        weekdayFormatter.format(new Date(2024, 0, 7 + index)),
      ),
    [],
  );
  const summary = value.date
    ? shortFormatter.format(parseDate(value.date)!)
    : value.from
      ? value.to
        ? `${shortFormatter.format(parseDate(value.from)!)} – ${shortFormatter.format(parseDate(value.to)!)}`
        : `${shortFormatter.format(parseDate(value.from)!)} – …`
      : (emptyLabel ?? t('anyDate'));

  const changeMode = (nextMode: DateMode) => {
    setMode(nextMode);
    if (nextMode === 'single') {
      const nextDate = value.date || value.from;
      onChange({ date: nextDate, from: '', to: '' });
      if (nextDate) setVisibleMonth(startOfMonth(parseDate(nextDate)!));
      return;
    }
    const nextFrom = value.from || value.date;
    onChange({ date: '', from: nextFrom, to: value.to });
    if (nextFrom) setVisibleMonth(startOfMonth(parseDate(nextFrom)!));
  };

  const selectDay = (day: Date) => {
    const selected = dateKey(day);
    if (mode === 'single') {
      onChange({ date: selected, from: '', to: '' });
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!value.from || value.to) {
      onChange({ date: '', from: selected, to: '' });
      return;
    }
    const [from, to] = selected < value.from ? [selected, value.from] : [value.from, selected];
    onChange({ date: '', from, to });
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="filter-control flex min-h-12 w-full items-center gap-3 rounded-xl border border-input bg-surface-raised px-3.5 text-left text-sm shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
        aria-label={`${accessibleLabel}: ${summary}`}
        aria-haspopup="dialog"
        aria-controls={menuId}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{summary}</span>
        <ChevronDown
          className={clsx(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="dialog"
            aria-label={accessibleLabel}
            style={position}
            className="fixed z-[100] overflow-y-auto rounded-2xl border border-border bg-surface-raised p-4 shadow-[0_18px_48px_rgb(0_0_0/0.18)]"
          >
            {!rangeOnly && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-sunken p-1">
                {(['single', 'range'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={clsx(
                      'filter-control min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors',
                      mode === option
                        ? 'bg-surface-raised text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-pressed={mode === option}
                    onClick={() => changeMode(option)}
                  >
                    {t(option === 'single' ? 'singleDate' : 'dateRange')}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="filter-control grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('previousMonth')}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <p className="font-semibold">{monthFormatter.format(visibleMonth)}</p>
              <button
                type="button"
                className="filter-control grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('nextMonth')}
                onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold uppercase text-muted-foreground">
              {weekdays.map((weekday, index) => (
                <span key={`${weekday}-${index}`} className="py-1">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5" role="grid">
              {days.map((day) => {
                const key = dateKey(day);
                const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
                const isSelected = key === value.date || key === value.from || key === value.to;
                const inRange = Boolean(
                  value.from && value.to && key > value.from && key < value.to,
                );
                const isToday = key === dateKey(new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-label={longFormatter.format(day)}
                    aria-selected={isSelected || inRange}
                    className={clsx(
                      'filter-control relative grid aspect-square place-items-center rounded-lg text-sm transition-colors hover:bg-muted',
                      outsideMonth && 'text-muted-foreground/45',
                      inRange && 'bg-info/10 text-info',
                      isSelected &&
                        'bg-primary font-bold text-primary-foreground hover:bg-primary/85',
                    )}
                    onClick={() => selectDay(day)}
                  >
                    {day.getDate()}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 size-1 rounded-full bg-info" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {mode === 'single'
                  ? t('chooseSingleDate')
                  : value.from && !value.to
                    ? t('chooseRangeEnd')
                    : t('chooseRangeStart')}
              </p>
              {(value.date || value.from || value.to) && (
                <button
                  type="button"
                  className="filter-control rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                  onClick={() => onChange({ date: '', from: '', to: '' })}
                >
                  {t('clearDate')}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
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
