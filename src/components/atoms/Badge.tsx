import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Badge({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
