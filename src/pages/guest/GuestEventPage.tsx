import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ConciergeWorkspace } from '../../components/organisms/ConciergeWorkspace';
import { apiClient } from '../../lib/api/api-client';
import type { ScheduleItem } from '../../types/domain';
import { GuestAccessState, guestAccessStateFromError } from './GuestAccessState';

type GuestEvent = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  destination: string | null;
  venue: string | null;
  venueAddress: string | null;
  venueDetails: string | null;
  restroomInformation: string | null;
  accessibilityInformation: string | null;
  parkingInformation: string | null;
  wifiInformation: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  organizerName: string | null;
  accessClosesAt?: string;
  schedule: ScheduleItem[];
};

export function GuestEventPage() {
  const { t } = useTranslation('guest');
  const { eventId = '' } = useParams();
  const [now, setNow] = useState(Date.now);
  const event = useQuery({
    queryKey: ['guest-event', eventId],
    queryFn: ({ signal }) => apiClient.get<GuestEvent>(`/guest/events/${eventId}`, signal),
    retry: false,
    refetchInterval: 30_000,
  });
  const closesAt = event.data?.accessClosesAt ? Date.parse(event.data.accessClosesAt) : undefined;
  useEffect(() => {
    if (closesAt === undefined || closesAt <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, closesAt - Date.now()), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [closesAt, now]);
  const state = guestAccessStateFromError(event.error);
  if (state) return <GuestAccessState state={state} />;
  if (closesAt !== undefined && now >= closesAt) return <GuestAccessState state="ENDED" eventName={event.data?.name} />;
  if (!event.data || event.isError) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-4xl">
            {event.isLoading ? t('openingEvent') : t('accessUnavailable')}
          </h1>
          {event.isError && <p className="mt-3 text-muted-foreground">{t('accessRecovery')}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {t(`categories.${event.data.category}`, { ns: 'events' })}
        </p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{event.data.name}</h1>
        <div className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {event.data.startAt
              ? new Intl.DateTimeFormat('en', {
                  dateStyle: 'long',
                  timeZone: event.data.timezone ?? 'UTC',
                }).format(new Date(event.data.startAt))
              : t('datesPending', { ns: 'events' })}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4" />
            {event.data.venue ?? event.data.destination}
          </span>
        </div>
      </header>
      <div className="mt-5">
        <ConciergeWorkspace eventId={event.data.id} guest />
      </div>
      {(event.data.venueAddress ||
        event.data.venueDetails ||
        event.data.restroomInformation ||
        event.data.accessibilityInformation ||
        event.data.parkingInformation ||
        event.data.wifiInformation) && (
        <section className="mt-8 rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-3xl">{t('venueGuide')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <GuestDetail
              label={t('venueAddress', { ns: 'events' })}
              value={event.data.venueAddress}
            />
            <GuestDetail
              label={t('venueDetails', { ns: 'events' })}
              value={event.data.venueDetails}
            />
            <GuestDetail
              label={t('restroomInformation', { ns: 'events' })}
              value={event.data.restroomInformation}
            />
            <GuestDetail
              label={t('accessibilityInformation', { ns: 'events' })}
              value={event.data.accessibilityInformation}
            />
            <GuestDetail
              label={t('parkingInformation', { ns: 'events' })}
              value={event.data.parkingInformation}
            />
            <GuestDetail
              label={t('wifiInformation', { ns: 'events' })}
              value={event.data.wifiInformation}
            />
          </div>
        </section>
      )}
      {event.data.schedule.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-3xl">{t('today')}</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
            {event.data.schedule.slice(0, 6).map((item) => (
              <article
                key={item.id}
                className="grid gap-1 border-b border-border p-4 last:border-0 sm:grid-cols-[9rem_1fr]"
              >
                <time className="text-sm font-semibold text-primary">
                  {new Intl.DateTimeFormat('en', {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: event.data.timezone ?? 'UTC',
                  }).format(new Date(item.startAt))}
                </time>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.location}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GuestDetail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}
