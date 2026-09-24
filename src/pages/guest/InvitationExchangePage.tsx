import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/atoms/Spinner';
import { apiClient } from '../../lib/api/api-client';
import { GuestConfirmation, type GuestIdentity } from './GuestConfirmation';
import { GuestAccessState, guestAccessStateFromError, type AccessState } from './GuestAccessState';

type Preview = {
  event: {
    id: string;
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
  requiresConfirmation: true;
};



export function InvitationExchangePage() {
  const { invitationToken = '' } = useParams();
  const { t } = useTranslation('guest');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ['invitation-preview', invitationToken],
    queryFn: () =>
      apiClient.post<Preview>(
        '/public/invitations/preview',
        { token: invitationToken },
        { skipRefresh: true },
      ),
    retry: false,
  });
  const exchange = useMutation({
    mutationFn: (values: GuestIdentity) =>
      apiClient.post<{ eventId: string }>(
        '/public/invitations/exchange',
        { token: invitationToken, ...values },
        { skipRefresh: true },
      ),
    onSuccess: ({ eventId }) => {
      queryClient.removeQueries({ queryKey: ['guest-event'] });
      queryClient.removeQueries({ queryKey: ['concierge'] });
      void navigate(`/guest/events/${eventId}`, { replace: true });
    },
  });
  const deniedState = guestAccessStateFromError(exchange.error);
  if (deniedState) return <GuestAccessState state={deniedState} />;
  if (preview.isLoading)
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Spinner label={t('invitation')} />
      </div>
    );
  if (!preview.data)
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-4xl">{t('invitationUnavailable')}</h1>
          <p className="mt-3 text-muted-foreground">{t('expired')}</p>
        </div>
      </div>
    );
  if (preview.data.event.accessState !== 'ACTIVE')
    return (
      <GuestAccessState
        state={preview.data.event.accessState}
        eventName={preview.data.event.name}
      />
    );
  const event = preview.data.event;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:pt-16">
      <section className="py-6 lg:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {t(`categories.${event.category}`, { ns: 'events' })}
        </p>
        <h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">{event.name}</h1>
        {event.description && (
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{event.description}</p>
        )}
        <div className="mt-8 flex flex-col gap-3 text-sm sm:flex-row sm:gap-6">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            {event.startAt
              ? new Intl.DateTimeFormat('en', {
                  dateStyle: 'long',
                  timeZone: event.timezone ?? 'UTC',
                }).format(new Date(event.startAt))
              : '—'}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="size-4" />
            {event.venue ?? event.destination}
          </span>
        </div>
      </section>
      <GuestConfirmation onConfirm={(identity) => exchange.mutate(identity)} pending={exchange.isPending} error={exchange.isError} />
    </div>
  );
}
