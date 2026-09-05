import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type AccessState = 'ACTIVE' | 'NOT_STARTED' | 'ENDED' | 'CANCELLED' | 'UNAVAILABLE';

export function GuestAccessState({ state, eventName }: { state: AccessState; eventName?: string }) {
  const { t } = useTranslation('guest');
  const key =
    state === 'NOT_STARTED'
      ? 'notStarted'
      : state === 'ENDED'
        ? 'ended'
        : state === 'CANCELLED'
          ? 'cancelled'
          : null;
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div className="max-w-xl rounded-2xl border border-border bg-surface p-8 sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          <CalendarClock className="size-6" />
        </span>
        {eventName && (
          <p className="mt-5 text-sm font-semibold text-muted-foreground">{eventName}</p>
        )}
        <h1 className="mt-2 font-display text-4xl">
          {key ? t(`${key}Title`) : t('eventUnavailable')}
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">{key ? t(key) : t('eventInactive')}</p>
      </div>
    </div>
  );
}
