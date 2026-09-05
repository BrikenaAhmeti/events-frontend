import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, MapPin, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input, Textarea } from '../../components/atoms/Input';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { FormField } from '../../components/molecules/FormField';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { CompletenessPanel } from '../../features/events/CompletenessPanel';
import { apiClient } from '../../lib/api/api-client';
import { eventKeys } from '../../lib/api/query-keys';
import type { EventDetail } from '../../types/domain';
import type { EventOutletContext } from './EventLayout';

const schema = z.object({
  description: z.string().min(10),
  destination: z.string().min(2),
  venue: z.string(),
  venueAddress: z.string(),
  venueDetails: z.string(),
  restroomInformation: z.string(),
  accessibilityInformation: z.string(),
  parkingInformation: z.string(),
  wifiInformation: z.string(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  timezone: z.string().min(3),
  organizerName: z.string().min(2),
  organizerEmail: z.email(),
});
type Values = z.infer<typeof schema>;
const localDateTime = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';

export function EventOverviewPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('events');
  const { data: user } = useCurrentUser();
  const mayEdit = Boolean(user && event.capabilities.canEdit);
  const mayPublish = Boolean(
    user && event.capabilities.canEdit && can(user, 'EVENT_PUBLISH', event.clientId),
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: event.description ?? '',
      destination: event.destination ?? '',
      venue: event.venue ?? '',
      venueAddress: event.venueAddress ?? '',
      venueDetails: event.venueDetails ?? '',
      restroomInformation: event.restroomInformation ?? '',
      accessibilityInformation: event.accessibilityInformation ?? '',
      parkingInformation: event.parkingInformation ?? '',
      wifiInformation: event.wifiInformation ?? '',
      startAt: localDateTime(event.startAt),
      endAt: localDateTime(event.endAt),
      timezone: event.timezone ?? '',
      organizerName: event.organizerName ?? '',
      organizerEmail: event.organizerEmail ?? '',
    },
  });
  const update = useMutation({
    mutationFn: (values: Values) =>
      apiClient.patch<EventDetail>(`/events/${event.id}`, {
        ...values,
        venue: values.venue || null,
        venueAddress: values.venueAddress || null,
        venueDetails: values.venueDetails || null,
        restroomInformation: values.restroomInformation || null,
        accessibilityInformation: values.accessibilityInformation || null,
        parkingInformation: values.parkingInformation || null,
        wifiInformation: values.wifiInformation || null,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      showToast(t('updated'));
      setEditing(false);
    },
  });
  const publish = useMutation({
    mutationFn: () => apiClient.post<EventDetail>(`/events/${event.id}/publish`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      showToast(t('publishedToast'));
      setPublishOpen(false);
      void navigate(`/app/events/${event.id}/concierge`);
    },
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{t('details')}</h2>
            {mayEdit && (
              <Button size="sm" variant="quiet" onClick={() => setEditing((value) => !value)}>
                <PencilLine className="size-4" />
                {editing ? t('close', { ns: 'common' }) : t('edit')}
              </Button>
            )}
          </div>
          {editing ? (
            <form
              className="mt-6 grid gap-5 sm:grid-cols-2"
              onSubmit={(submitEvent) =>
                void form.handleSubmit((values) => update.mutate(values))(submitEvent)
              }
            >
              <div className="sm:col-span-2">
                <FormField label={t('description')} htmlFor="description">
                  <Textarea id="description" {...form.register('description')} />
                </FormField>
              </div>
              <FormField label={t('destination')} htmlFor="destination">
                <Input id="destination" {...form.register('destination')} />
              </FormField>
              <FormField label={t('venue')} htmlFor="venue">
                <Input id="venue" {...form.register('venue')} />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label={t('venueAddress')} htmlFor="venue-address">
                  <Input id="venue-address" {...form.register('venueAddress')} />
                </FormField>
              </div>
              <FormField label={t('startAt')} htmlFor="start">
                <Input id="start" type="datetime-local" {...form.register('startAt')} />
              </FormField>
              <FormField label={t('endAt')} htmlFor="end">
                <Input id="end" type="datetime-local" {...form.register('endAt')} />
              </FormField>
              <FormField label={t('timezone')} htmlFor="timezone">
                <Input id="timezone" placeholder="Europe/Madrid" {...form.register('timezone')} />
              </FormField>
              <FormField label={t('organizerName')} htmlFor="organizer">
                <Input id="organizer" {...form.register('organizerName')} />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label={t('organizerEmail')} htmlFor="organizer-email">
                  <Input id="organizer-email" type="email" {...form.register('organizerEmail')} />
                </FormField>
              </div>
              {(
                [
                  ['venueDetails', t('venueDetails')],
                  ['restroomInformation', t('restroomInformation')],
                  ['accessibilityInformation', t('accessibilityInformation')],
                  ['parkingInformation', t('parkingInformation')],
                  ['wifiInformation', t('wifiInformation')],
                ] as Array<[keyof Values, string]>
              ).map(([key, label]) => (
                <div key={key} className="sm:col-span-2">
                  <FormField label={label} htmlFor={`event-${key}`}>
                    <Textarea id={`event-${key}`} {...form.register(key)} />
                  </FormField>
                </div>
              ))}
              <div className="sm:col-span-2">
                <Button type="submit" loading={update.isPending}>
                  {t('save', { ns: 'common' })}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail
                icon={MapPin}
                label={t('location')}
                value={
                  [event.venue, event.destination].filter(Boolean).join(', ') ||
                  t('pending', { ns: 'common' })
                }
              />
              <Detail
                icon={CalendarDays}
                label={t('dateRange')}
                value={
                  event.startAt
                    ? `${new Date(event.startAt).toLocaleDateString()} – ${event.endAt ? new Date(event.endAt).toLocaleDateString() : t('tbc', { ns: 'common' })}`
                    : t('pending', { ns: 'common' })
                }
              />
              <Detail
                icon={Mail}
                label={t('organizer')}
                value={`${event.organizerName ?? t('pending', { ns: 'common' })}${event.organizerEmail ? ` · ${event.organizerEmail}` : ''}`}
              />
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {t('purpose')}
                </p>
                <p className="mt-2 leading-7">
                  {event.description ?? t('notProvided', { ns: 'common' })}
                </p>
              </div>
              {(event.venueAddress ||
                event.venueDetails ||
                event.restroomInformation ||
                event.accessibilityInformation ||
                event.parkingInformation ||
                event.wifiInformation) && (
                <div className="grid gap-3 rounded-lg bg-surface-sunken p-4 sm:col-span-2 sm:grid-cols-2">
                  <VenueFact label={t('venueAddress')} value={event.venueAddress} />
                  <VenueFact label={t('venueDetails')} value={event.venueDetails} />
                  <VenueFact label={t('restroomInformation')} value={event.restroomInformation} />
                  <VenueFact
                    label={t('accessibilityInformation')}
                    value={event.accessibilityInformation}
                  />
                  <VenueFact label={t('parkingInformation')} value={event.parkingInformation} />
                  <VenueFact label={t('wifiInformation')} value={event.wifiInformation} />
                </div>
              )}
            </div>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">{t('schedulePreview')}</h2>
          <div className="mt-4 space-y-3">
            {event.schedule.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="grid gap-1 border-l-2 border-secondary pl-4 sm:grid-cols-[9rem_1fr]"
              >
                <p className="text-sm font-semibold">
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: event.timezone ?? 'UTC',
                  }).format(new Date(item.startAt))}
                </p>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.location}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="space-y-4">
        <CompletenessPanel completeness={event.completeness} />
        {mayPublish && event.status !== 'PUBLISHED' && (
          <Button
            className="w-full"
            size="lg"
            disabled={!event.completeness.ready}
            onClick={() => setPublishOpen(true)}
          >
            {t('publish')}
          </Button>
        )}
      </aside>
      <ConfirmDialog
        open={publishOpen}
        title={t('publish')}
        description={t('publishConfirm')}
        confirmLabel={t('publish')}
        onClose={() => setPublishOpen(false)}
        onConfirm={() => publish.mutate()}
      />
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-surface-sunken p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function VenueFact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}
