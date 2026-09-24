import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Badge({
  className,
  children,
  prominent = false,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { prominent?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center border border-border bg-surface-sunken text-muted-foreground',
        prominent
          ? 'rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm'
          : 'rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
