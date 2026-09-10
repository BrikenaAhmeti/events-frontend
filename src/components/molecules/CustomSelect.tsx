import clsx from 'clsx';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export type CustomSelectOption = {
  value: string;
  label: string;
};

export function CustomSelect({
  value,
  options,
  label,
  icon: Icon,
  onChange,
  className,
  disabled = false,
}: {
  value: string;
  options: CustomSelectOption[];
  label: string;
  icon?: LucideIcon;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

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

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="filter-control flex min-h-11 w-full items-center gap-3 rounded-lg border border-input bg-surface px-3.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60 disabled:opacity-60"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="min-w-0 flex-1 truncate font-medium">{selected?.label}</span>
        <ChevronDown
          className={clsx(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-2 max-h-72 w-full min-w-52 overflow-y-auto rounded-xl border border-border bg-surface-raised p-1.5 shadow-[0_18px_48px_rgb(0_0_0/0.18)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={clsx(
                  'filter-control flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
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
      )}
    </div>
  );
}
