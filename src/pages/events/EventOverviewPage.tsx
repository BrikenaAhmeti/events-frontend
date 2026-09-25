import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, MapPin, PencilLine, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input, Textarea } from '../../components/atoms/Input';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { DateTimePicker } from '../../components/molecules/DateTimePicker';
import { FormField } from '../../components/molecules/FormField';
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
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  timezone: z.string().min(3),
  organizerName: z.string().min(2),
  organizerEmail: z.email(),
  details: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(5_000),
      }),
    )
    .max(200),
});
type Values = z.infer<typeof schema>;
const localDateTime = (value: string | null) =>
  value ? new Date(value).toISOString().slice(0, 16) : '';

export function EventOverviewPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('events');
  const { data: user } = useCurrentUser();
  const mayEdit = Boolean(user && event.capabilities.canEdit);
  const [searchParams, setSearchParams] = useSearchParams();
  const mayPublish = Boolean(
    user && (event.capabilities.canPublish ?? event.capabilities.canEdit),
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [sendInvitationsOnPublish, setSendInvitationsOnPublish] = useState<boolean | null>(null);
  const editing = mayEdit && searchParams.get('edit') === '1';
  const setEditMode = (value: boolean) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('edit', '1');
      else next.delete('edit');
      return next;
    }, { replace: true });
  };
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
      startAt: localDateTime(event.startAt),
      endAt: localDateTime(event.endAt),
      timezone: event.timezone ?? '',
      organizerName: event.organizerName ?? '',
      organizerEmail: event.organizerEmail ?? '',
      details: event.facts.map((fact) => ({
        title: formatFactTitle(fact.key),
        description: fact.value,
      })),
    },
  });
  const details = useFieldArray({ control: form.control, name: 'details' });
  const update = useMutation({
    mutationFn: ({ details: submittedDetails, ...values }: Values) =>
      apiClient.patch<EventDetail>(`/events/${event.id}`, {
        ...values,
        venue: values.venue || null,
        venueAddress: values.venueAddress || null,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
        facts: submittedDetails.map((detail) => ({
          key: detail.title,
          value: detail.description,
          confidence: 1,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      showToast(t('updated'));
      setEditMode(false);
    },
  });
  const publish = useMutation({
    mutationFn: (sendInvitations: boolean) => apiClient.post<EventDetail>(`/events/${event.id}/publish`, { sendInvitations }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      showToast(t('publishedToast'));
      setPublishOpen(false);
      void navigate(`/app/events/${event.id}/concierge`);
    },
  });
  const additionalDetails = [
    ...event.facts.map((fact) => ({ title: formatFactTitle(fact.key), description: fact.value })),
    ...(event.venueAddress
      ? [{ title: t('venueAddress'), description: event.venueAddress }]
      : []),
    ...(event.venueDetails
      ? [{ title: t('venueDetails'), description: event.venueDetails }]
      : []),
    ...(event.restroomInformation
      ? [{ title: t('restroomInformation'), description: event.restroomInformation }]
      : []),
    ...(event.accessibilityInformation
      ? [{ title: t('accessibilityInformation'), description: event.accessibilityInformation }]
      : []),
    ...(event.parkingInformation
      ? [{ title: t('parkingInformation'), description: event.parkingInformation }]
      : []),
    ...(event.wifiInformation
      ? [{ title: t('wifiInformation'), description: event.wifiInformation }]
      : []),
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{t('details')}</h2>
            {mayEdit && (
              <Button size="sm" variant="secondary" onClick={() => setEditMode(!editing)}>
                <PencilLine className="size-4" />
                {editing ? t('close', { ns: 'common' }) : t('editEvent')}
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
                <Controller
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <DateTimePicker
                      id="start"
                      label={t('startAt')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FormField>
              <FormField label={t('endAt')} htmlFor="end">
                <Controller
                  control={form.control}
                  name="endAt"
                  render={({ field }) => (
                    <DateTimePicker
                      id="end"
                      label={t('endAt')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
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
              <div className="rounded-xl border border-border bg-surface-sunken/35 p-4 sm:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{t('additionalDetails')}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t('additionalDetailsDescription')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => details.append({ title: '', description: '' })}
                  >
                    <Plus className="size-4" />
                    {t('addDetail')}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t('additionalDetailsExamples')}</p>
                <div className="mt-4 space-y-3">
                  {details.fields.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {t('noAdditionalDetails')}
                    </p>
                  )}
                  {details.fields.map((detail, index) => (
                    <div
                      key={detail.id}
                      className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:items-start"
                    >
                      <FormField
                        label={t('detailTitle')}
                        htmlFor={`event-detail-title-${index}`}
                      >
                        <Input
                          id={`event-detail-title-${index}`}
                          placeholder={t('detailTitlePlaceholder')}
                          {...form.register(`details.${index}.title`)}
                        />
                      </FormField>
                      <FormField
                        label={t('detailDescription')}
                        htmlFor={`event-detail-description-${index}`}
                      >
                        <Textarea
                          id={`event-detail-description-${index}`}
                          className="!min-h-12"
                          placeholder={t('detailDescriptionPlaceholder')}
                          {...form.register(`details.${index}.description`)}
                        />
                      </FormField>
                      <button
                        type="button"
                        className="mt-6 grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={t('removeDetail')}
                        onClick={() => details.remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
              {additionalDetails.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('additionalDetails')}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {additionalDetails.map((detail, index) => (
                      <VenueFact
                        key={`${detail.title}-${index}`}
                        label={detail.title}
                        value={detail.description}
                      />
                    ))}
                  </div>
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
        confirmDisabled={sendInvitationsOnPublish === null}
        loading={publish.isPending}
        onClose={() => setPublishOpen(false)}
        onConfirm={() => { if (sendInvitationsOnPublish !== null) publish.mutate(sendInvitationsOnPublish); }}
      >
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-start gap-2 rounded-lg border border-border p-3">
            <input type="radio" name="send-invitations-on-publish" checked={sendInvitationsOnPublish === true} onChange={() => setSendInvitationsOnPublish(true)} />
            <span>{t('publishAndSend')}</span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-border p-3">
            <input type="radio" name="send-invitations-on-publish" checked={sendInvitationsOnPublish === false} onChange={() => setSendInvitationsOnPublish(false)} />
            <span>{t('publishWithoutSending')}</span>
          </label>
        </div>
        {publish.error && <p role="alert" className="mt-3 text-sm text-danger">{publish.error.message}</p>}
      </ConfirmDialog>
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

function formatFactTitle(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
