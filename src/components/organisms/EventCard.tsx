import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { EventSummary } from '../../types/domain';
import { EventStatusSummary } from '../molecules/EventStatusSummary';

const formatDate = (value: string | null, timezone: string | null, fallback: string) =>
  value
    ? new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone ?? 'UTC',
      }).format(new Date(value))
    : fallback;

export function EventCard({ event }: { event: EventSummary }) {
  const { t } = useTranslation('events');
  return (
    <Link
      to={`/app/events/${event.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transform-none sm:p-6"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t(`categories.${event.category}`)}
        </p>
        <h2 className="mt-2 font-display text-2xl leading-tight group-hover:text-primary">
          {event.name}
        </h2>
      </div>
      <EventStatusSummary
        className="mt-4"
        status={event.status}
        operationalStatus={event.operationalStatus}
      />
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {event.description ?? t('continueShaping')}
      </p>
      <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          {formatDate(event.startAt, event.timezone, t('datesPending'))}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="size-4" />
          {event.destination ?? event.venue ?? t('locationPending')}
        </span>
        <span className="flex items-center gap-2">
          <Users className="size-4" />
          {t('guestCount', { count: event._count?.guests ?? 0 })}
        </span>
      </div>
      <div className="mt-auto pt-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span>{t('readiness')}</span>
          <span>{event.completeness.score}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${event.completeness.score}%` }}
          />
        </div>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:underline">
          {t(event.capabilities.canEdit ? 'viewDetailsAndEdit' : 'viewDetails')}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
