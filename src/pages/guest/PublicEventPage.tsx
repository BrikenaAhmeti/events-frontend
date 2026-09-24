import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api/api-client';
import { GuestConfirmation, type GuestIdentity } from './GuestConfirmation';
import { GuestAccessState, guestAccessStateFromError, type AccessState } from './GuestAccessState';

type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  destination: string | null;
  venue: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  accessState: AccessState;
};


export function PublicEventPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation('guest');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const event = useQuery({
    queryKey: ['public-event', slug],
    queryFn: ({ signal }) => apiClient.get<PublicEvent>(`/public/events/${slug}`, signal),
    retry: false,
  });
  const access = useMutation({
    mutationFn: (values: GuestIdentity) =>
      apiClient.post<{ eventId: string }>(`/public/events/${slug}/access`, values, {
        skipRefresh: true,
      }),
    onSuccess: ({ eventId }) => {
      queryClient.removeQueries({ queryKey: ['guest-event'] });
      queryClient.removeQueries({ queryKey: ['concierge'] });
      void navigate(`/guest/events/${eventId}`, { replace: true });
    },
  });
  const deniedState = guestAccessStateFromError(access.error);
  if (deniedState) return <GuestAccessState state={deniedState} />;
  if (!event.data)
    return event.isLoading ? (
      <div className="grid min-h-[70vh] place-items-center">{t('loadingEvent')}</div>
    ) : (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-4xl">{t('eventUnavailable')}</h1>
          <p className="mt-3 text-muted-foreground">{t('eventInactive')}</p>
        </div>
      </div>
    );
  if (event.data.accessState !== 'ACTIVE')
    return <GuestAccessState state={event.data.accessState} eventName={event.data.name} />;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:pt-16">
      <section className="py-6 lg:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {t(`categories.${event.data.category}`, { ns: 'events' })}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {t('welcome', { event: event.data.name })}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          {event.data.description}
        </p>
        <div className="mt-8 flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            {event.data.startAt
              ? new Intl.DateTimeFormat('en', {
                  dateStyle: 'long',
                  timeZone: event.data.timezone ?? 'UTC',
                }).format(new Date(event.data.startAt))
              : t('datesPending', { ns: 'events' })}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            {event.data.venue ?? event.data.destination}
          </span>
        </div>
      </section>
      <GuestConfirmation onConfirm={(identity) => access.mutate(identity)} pending={access.isPending} error={access.isError} />
    </div>
  );
}
