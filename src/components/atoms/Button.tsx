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
        'group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-semibold transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none',
        variant === 'primary' &&
          'border-primary bg-primary text-primary-foreground shadow-[0_5px_0_rgb(0_0_0/0.2)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_7px_0_rgb(0_0_0/0.17)] active:translate-y-0.5 active:shadow-[0_2px_0_rgb(0_0_0/0.2)]',
        variant === 'secondary' &&
          'border-border bg-surface-raised text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted hover:shadow-md active:translate-y-0 active:shadow-sm',
        variant === 'quiet' &&
          'border-transparent bg-transparent text-foreground hover:bg-muted active:bg-muted/75',
        variant === 'warning' &&
          'border-warning/40 bg-warning/10 text-warning shadow-sm hover:-translate-y-0.5 hover:bg-warning/20 hover:shadow-md active:translate-y-0',
        variant === 'danger' &&
          'border-danger/40 bg-danger/10 text-danger shadow-sm hover:-translate-y-0.5 hover:bg-danger/20 hover:shadow-md active:translate-y-0',
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
