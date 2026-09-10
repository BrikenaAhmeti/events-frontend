import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:opacity-55',
        variant === 'primary' &&
          'border-black bg-[var(--action-primary)] text-[var(--action-primary-foreground)] hover:opacity-85',
        variant === 'secondary' &&
          'border-black bg-[var(--action-secondary)] text-[var(--action-secondary-foreground)] hover:opacity-85',
        variant === 'quiet' && 'border-transparent bg-transparent text-foreground hover:bg-muted',
        variant === 'warning' &&
          'border-warning/50 bg-warning/10 text-warning hover:bg-warning/20',
        variant === 'danger' &&
          'border-danger/50 bg-danger/10 text-danger hover:bg-danger/20',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'px-4 text-sm',
        size === 'lg' && 'min-h-12 px-5',
        className,
      )}
      {...props}
    >
      {loading && (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {children}
    </button>
  );
});
