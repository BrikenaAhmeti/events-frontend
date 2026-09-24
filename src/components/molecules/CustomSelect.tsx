import clsx from 'clsx';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../atoms/Button';
import { usePopoverPosition } from '../../lib/use-popover-position';

export type CustomSelectOption = {
  value: string;
  label: string;
};

type SharedSelectProps = {
  id?: string;
  options: CustomSelectOption[];
  label: string;
  icon?: LucideIcon;
  className?: string;
  disabled?: boolean;
};

export function CustomSelect({
  id,
  value,
  options,
  label,
  icon: Icon,
  onChange,
  className,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search options',
  noResultsText = 'No matching options',
}: SharedSelectProps & {
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const position = usePopoverPosition(open, triggerRef);
  const filtered = options.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(search.toLowerCase()),
  );

  useSelectDismiss(open, setOpen, triggerRef, rootRef, menuRef);
  useFocusSelectedOption(open && !searchable, menuRef);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <SelectTrigger
        id={id}
        ref={triggerRef}
        label={label}
        open={open}
        disabled={disabled}
        icon={Icon}
        value={selected?.label ?? label}
        menuId={menuId}
        onToggle={() => {
          setSearch('');
          setOpen((current) => !current);
        }}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised p-1.5 shadow-[0_22px_60px_rgb(0_0_0/0.22)]"
            style={position}
            onKeyDown={handleListboxKeyboard}
          >
            {searchable && (
              <div className="shrink-0 pb-1.5">
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  className="min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-focus/25"
                />
              </div>
            )}
            <div id={menuId} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto">
              {filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={clsx(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-muted',
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Check
                      className={clsx('size-4 shrink-0', !isSelected && 'invisible')}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <p role="status" className="px-3 py-5 text-sm text-muted-foreground">
                {noResultsText}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function CustomMultiSelect({
  id,
  value,
  options,
  label,
  placeholder,
  icon: Icon,
  onChange,
  className,
  disabled = false,
  clearLabel = 'Clear',
  doneLabel = 'Done',
  selectedLabel = (count) => `${count} selected`,
}: SharedSelectProps & {
  value: string[];
  placeholder: string;
  onChange: (value: string[]) => void;
  clearLabel?: string;
  doneLabel?: string;
  selectedLabel?: (count: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const position = usePopoverPosition(open, triggerRef);
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const summary =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0]!.label
        : selectedLabel(selectedOptions.length);

  useSelectDismiss(open, setOpen, triggerRef, rootRef, menuRef);
  useFocusSelectedOption(open, menuRef);

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <SelectTrigger
        id={id}
        ref={triggerRef}
        label={label}
        open={open}
        disabled={disabled}
        icon={Icon}
        value={summary}
        badge={selectedOptions.length > 1 ? selectedOptions.length : undefined}
        menuId={menuId}
        onToggle={() => setOpen((current) => !current)}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="fixed z-[100] overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[0_22px_60px_rgb(0_0_0/0.22)]"
            style={position}
          >
            <div className="max-h-64 overflow-y-auto p-1.5" onKeyDown={handleListboxKeyboard}>
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={clsx(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35',
                      isSelected
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground hover:bg-muted',
                    )}
                    onClick={() =>
                      onChange(
                        isSelected
                          ? value.filter((selectedValue) => selectedValue !== option.value)
                          : [...value, option.value],
                      )
                    }
                  >
                    <span
                      className={clsx(
                        'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-surface',
                      )}
                      aria-hidden
                    >
                      {isSelected && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-sunken/35 p-2">
              <Button
                type="button"
                size="sm"
                variant="quiet"
                disabled={value.length === 0}
                onClick={() => onChange([])}
              >
                {clearLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                {doneLabel}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const SelectTrigger = forwardRef<
  HTMLButtonElement,
  {
    id?: string;
    label: string;
    value: string;
    open: boolean;
    disabled: boolean;
    icon?: LucideIcon;
    badge?: number;
    menuId: string;
    onToggle: () => void;
  }
>(function SelectTrigger(
  { id, label, value, open, disabled, icon: Icon, badge, menuId, onToggle },
  ref,
) {
  return (
    <button
      id={id}
      ref={ref}
      type="button"
      className={clsx(
        'filter-control flex min-h-12 w-full items-center gap-3 rounded-xl border bg-surface-raised px-3.5 text-left text-sm text-foreground shadow-sm transition-[background-color,border-color,box-shadow] hover:border-primary/45 hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50',
        open && 'border-primary/55 bg-muted/50 shadow-[0_0_0_3px_rgb(22_41_43/0.12)]',
      )}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={menuId}
      disabled={disabled}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="min-w-0 flex-1 truncate font-semibold">{value}</span>
      {badge !== undefined && (
        <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
          {badge}
        </span>
      )}
      <ChevronDown
        className={clsx(
          'size-4 shrink-0 text-muted-foreground transition-transform',
          open && 'rotate-180 text-foreground',
        )}
        aria-hidden
      />
    </button>
  );
});

function useSelectDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  triggerRef: RefObject<HTMLButtonElement | null>,
  rootRef: RefObject<HTMLDivElement | null>,
  menuRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
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
  }, [menuRef, open, rootRef, setOpen, triggerRef]);
}

function useFocusSelectedOption(open: boolean, menuRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selected = menuRef.current?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      );
      const first = menuRef.current?.querySelector<HTMLElement>('[role="option"]');
      (selected ?? first)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [menuRef, open]);
}

function handleListboxKeyboard(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  if (event.target instanceof HTMLInputElement && ['Home', 'End'].includes(event.key)) return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
  if (options.length === 0) return;
  event.preventDefault();
  const current = options.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : current < 0
          ? event.key === 'ArrowUp'
            ? options.length - 1
            : 0
          : event.key === 'ArrowDown'
            ? (current + 1 + options.length) % options.length
            : (current - 1 + options.length) % options.length;
  options[next]?.focus();
}
