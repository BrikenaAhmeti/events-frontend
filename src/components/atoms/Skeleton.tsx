import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'block animate-pulse rounded-lg bg-muted motion-reduce:animate-none',
        className,
      )}
      aria-hidden
    />
  );
}
