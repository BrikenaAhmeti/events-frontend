import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { Spinner } from '../../components/atoms/Spinner';
import { apiClient } from '../../lib/api/api-client';
import { GuestAccessState, type AccessState } from './GuestAccessState';

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

const schema = z.object({ fullName: z.string().min(2), email: z.email() });
type Values = z.infer<typeof schema>;

export function InvitationExchangePage() {
  const { invitationToken = '' } = useParams();
  const { t } = useTranslation('guest');
  const navigate = useNavigate();
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
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '' },
  });
  const exchange = useMutation({
    mutationFn: (values: Values) =>
      apiClient.post<{ eventId: string }>(
        '/public/invitations/exchange',
        { token: invitationToken, ...values },
        { skipRefresh: true },
      ),
    onSuccess: ({ eventId }) => void navigate(`/guest/events/${eventId}`, { replace: true }),
  });
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
      <aside className="rounded-2xl border border-border bg-surface-raised p-6">
        <h2 className="font-display text-2xl">{t('enterTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('confirmInvitation')}</p>
        <form
          className="mt-6 space-y-5"
          onSubmit={(submitEvent) =>
            void form.handleSubmit((values) => exchange.mutate(values))(submitEvent)
          }
        >
          <FormField
            label={t('fullName', { ns: 'guests' })}
            htmlFor="invitation-name"
            error={form.formState.errors.fullName?.message}
          >
            <Input id="invitation-name" autoComplete="name" {...form.register('fullName')} />
          </FormField>
          <FormField
            label={t('email', { ns: 'common' })}
            htmlFor="invitation-email"
            error={form.formState.errors.email?.message}
          >
            <Input
              id="invitation-email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
            />
          </FormField>
          {exchange.error && (
            <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
              {t('confirmationDenied')}
            </p>
          )}
          <Button className="w-full" type="submit" loading={exchange.isPending}>
            {t('enter')}
          </Button>
        </form>
      </aside>
    </div>
  );
}
