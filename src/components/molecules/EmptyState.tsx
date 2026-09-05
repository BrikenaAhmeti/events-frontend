import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-surface-sunken/40 p-8 text-center">
      <div>
        <span className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <h3 className="font-display text-xl">{title}</h3>
        {description && (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
