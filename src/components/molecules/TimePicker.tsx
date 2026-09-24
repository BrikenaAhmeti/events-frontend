import clsx from 'clsx';
import { ChevronDown, Clock3 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePopoverPosition } from '../../lib/use-popover-position';

export function normalizeTime(value: string): string | null {
  const text = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  const digits = /^\d{1,4}$/.test(text) ? text : '';
  const hour = match?.[1] ?? (digits.length > 2 ? digits.slice(0, -2) : digits);
  const minute = match?.[2] ?? (digits.length > 2 ? digits.slice(-2) : '00');
  if (!hour || Number(hour) > 23 || Number(minute) > 59) return null;
  return `${hour.padStart(2, '0')}:${minute}`;
}

const options = Array.from(
  { length: 48 },
  (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
);

export function TimePicker({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('events');
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const position = usePopoverPosition(open, root);
  const normalized = normalizeTime(value);
  const choices =
    normalized && !options.includes(normalized) ? [...options, normalized].sort() : options;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      input.current?.focus();
    };
    const frame = requestAnimationFrame(() => {
      const selected = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      const morning = menu.current?.querySelector<HTMLElement>('[data-time="09:00"]');
      (selected ?? morning)?.focus();
    });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="flex min-h-12 items-center rounded-xl border border-input bg-surface-raised shadow-sm focus-within:ring-2 focus-within:ring-focus/20"
    >
      <Clock3 className="ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        type="text"
        inputMode="numeric"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        placeholder="HH:MM"
        maxLength={5}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (normalized) onChange(normalized);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="min-h-12 min-w-0 w-full bg-transparent px-2 text-base font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t('chooseTimeFor', { label })}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="grid min-h-12 w-9 shrink-0 place-items-center rounded-r-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            style={position}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised p-2 shadow-[0_18px_48px_rgb(0_0_0/0.18)]"
          >
            <p className="shrink-0 px-2 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
              {t('timePickerHint')}
            </p>
            <div
              id={id}
              role="listbox"
              aria-label={label}
              className="grid min-h-0 grid-cols-2 gap-1 overflow-y-auto"
              onKeyDown={(event) => {
                const steps: Record<string, number> = {
                  ArrowDown: 2,
                  ArrowUp: -2,
                  ArrowRight: 1,
                  ArrowLeft: -1,
                };
                const step = steps[event.key];
                if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
                event.preventDefault();
                const items = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'),
                );
                const current = items.indexOf(document.activeElement as HTMLElement);
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : Math.max(0, Math.min(items.length - 1, current + (step ?? 0)));
                items[next]?.focus();
              }}
            >
              {choices.map((time) => (
                <button
                  key={time}
                  type="button"
                  role="option"
                  data-time={time}
                  aria-selected={normalized === time}
                  onClick={() => {
                    onChange(time);
                    setOpen(false);
                    input.current?.focus();
                  }}
                  className={clsx(
                    'min-h-11 rounded-xl px-4 text-sm font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus/40',
                    normalized === time ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
