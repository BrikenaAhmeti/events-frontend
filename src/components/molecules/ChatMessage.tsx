import clsx from 'clsx';
import { MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function AssistantMessage({
  children,
  danger = false,
  wide = false,
}: {
  children: ReactNode;
  danger?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={clsx('flex items-end gap-2', wide && 'w-full')} data-message-role="assistant">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <MessageCircle className="size-4" aria-hidden />
      </span>
      <div
        className={clsx(
          'rounded-2xl rounded-bl-md border p-4 shadow-sm',
          wide ? 'w-[calc(100%-2.5rem)]' : 'max-w-[calc(94%-2.5rem)] sm:max-w-[82%]',
          danger
            ? 'border-danger/30 bg-danger/10 text-danger'
            : 'border-border bg-surface-raised',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground shadow-sm sm:max-w-[74%]"
      data-message-role="user"
    >
      {children}
    </div>
  );
}

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2" role="status" aria-label={label}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <MessageCircle className="size-4" aria-hidden />
      </span>
      <div className="flex h-11 items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface-raised px-4 shadow-sm">
        <span className="sr-only">{label}</span>
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-300ms] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-150ms] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none" />
      </div>
    </div>
  );
}
