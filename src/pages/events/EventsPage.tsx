import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Search,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Skeleton } from '../../components/atoms/Skeleton';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { CustomSelect } from '../../components/molecules/CustomSelect';
import { DateFilter } from '../../components/molecules/DateFilter';
import { EmptyState } from '../../components/molecules/EmptyState';
import { PageHeader } from '../../components/molecules/PageHeader';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { eventKeys } from '../../lib/api/query-keys';
import type { Client, EventSummary, Page } from '../../types/domain';

type Creator = { id: string; firstName: string; lastName: string; email: string };

export function EventsPage() {
  const { t } = useTranslation('events');
  const { data: user } = useCurrentUser();
  const [params] = useSearchParams();
  const [clientId, setClientId] = useState(
    params.get('clientId') ?? (user ? activeClientId(user) : undefined) ?? '',
  );
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [createdByUserId, setCreatedByUserId] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [confirmation, setConfirmation] = useState<{
    event: EventSummary;
    action: 'cancel' | 'delete';
  } | null>(null);
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const mayRead = Boolean(user && can(user, 'EVENT_READ', clientId || undefined));
  const mayCreate = Boolean(user && can(user, 'EVENT_CREATE', clientId || undefined));
  const clients = useQuery({
    queryKey: ['event-client-directory'],
    queryFn: ({ signal }) => apiClient.get<Client[]>('/events/directory/clients', signal),
    enabled: Boolean(isSuperAdmin),
  });
  const creators = useQuery({
    queryKey: ['event-creators', clientId],
    queryFn: ({ signal }) =>
      apiClient.get<Creator[]>(
        `/events/directory/creators${clientId ? `?clientId=${clientId}` : ''}`,
        signal,
      ),
    enabled: mayRead,
  });
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({
          clientId,
          search,
          lifecycle,
          date,
          from,
          to,
          createdByUserId,
          cursor: cursors.at(-1),
        }).filter(([, value]) => value),
      ) as Record<string, string>,
    [clientId, search, lifecycle, date, from, to, createdByUserId, cursors],
  );
  const events = useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ signal }) =>
      apiClient.get<Page<EventSummary>>(`/events?${new URLSearchParams(filters)}`, signal),
    enabled: mayRead,
  });
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const action = useMutation({
    mutationFn: async (target: NonNullable<typeof confirmation>) => {
      if (target.action === 'cancel') return apiClient.post(`/events/${target.event.id}/cancel`);
      return apiClient.delete(`/events/${target.event.id}`);
    },
    onSuccess: (_, target) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      showToast(t(target.action === 'cancel' ? 'cancelledToast' : 'deletedToast'));
      setConfirmation(null);
    },
    onError: (error) => showToast(error.message, 'danger'),
  });
  const resetPage = () => setCursors([undefined]);
  const clearFilters = () => {
    setSearch('');
    setLifecycle('');
    setDate('');
    setFrom('');
    setTo('');
    setCreatedByUserId('');
    resetPage();
  };
  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          mayCreate && clientId ? (
            <Link to={`/app/events/new?clientId=${clientId}`}>
              <Button>{t('create')}</Button>
            </Link>
          ) : undefined
        }
      />
      <section
        className="mb-5 rounded-xl border border-border bg-surface p-4"
        aria-label={t('filters')}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative md:col-span-2">
            <span className="sr-only">{t('searchPlaceholder')}</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="filter-control pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder={t('searchPlaceholder')}
            />
          </label>
          {isSuperAdmin && (
            <CustomSelect
              label={t('clientName')}
              icon={Building2}
              value={clientId}
              options={[
                { value: '', label: t('allClients') },
                ...(clients.data ?? []).map((client) => ({
                  value: client.id,
                  label: client.name,
                })),
              ]}
              onChange={(value) => {
                setClientId(value);
                setCreatedByUserId('');
                resetPage();
              }}
            />
          )}
          <CustomSelect
            label={t('lifecycle')}
            icon={ListFilter}
            value={lifecycle}
            options={[
              { value: '', label: t('allEvents') },
              ...['UPCOMING', 'ONGOING', 'PAST', 'CANCELLED', 'UNSCHEDULED'].map((status) => ({
                value: status,
                label: t(`statuses.${status}`, { ns: 'common' }),
              })),
            ]}
            onChange={(value) => {
              setLifecycle(value);
              resetPage();
            }}
          />
          <CustomSelect
            label={t('creator')}
            icon={UserRound}
            value={createdByUserId}
            options={[
              { value: '', label: t('allCreators') },
              ...(creators.data ?? []).map((creator) => ({
                value: creator.id,
                label: `${creator.firstName} ${creator.lastName}`,
              })),
            ]}
            onChange={(value) => {
              setCreatedByUserId(value);
              resetPage();
            }}
          />
          <DateFilter
            className="md:col-span-2 xl:col-span-2"
            value={{ date, from, to }}
            onChange={(nextValue) => {
              setDate(nextValue.date);
              setFrom(nextValue.from);
              setTo(nextValue.to);
              resetPage();
            }}
          />
          <Button className="filter-control" variant="quiet" onClick={clearFilters}>
            {t('clearFilters')}
          </Button>
        </div>
      </section>
      {events.isLoading ? (
        <Skeleton className="h-96" />
      ) : events.data?.items.length ? (
        <>
          <div className="space-y-3 md:hidden">
            {events.data.items.map((event) => (
              <article key={event.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      className="font-display text-xl hover:text-primary"
                      to={`/app/events/${event.id}`}
                    >
                      {event.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`categories.${event.category}`)}
                    </p>
                  </div>
                  <StatusBadge status={event.operationalStatus} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('clientName')}
                    </dt>
                    <dd className="mt-1">{event.client.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('dateRange')}
                    </dt>
                    <dd className="mt-1">{formatRange(event)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('creator')}
                    </dt>
                    <dd className="mt-1">
                      {event.createdBy.firstName} {event.createdBy.lastName}
                      <span className="block text-xs text-muted-foreground">
                        {event.createdBy.email}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('status', { ns: 'common' })}
                    </dt>
                    <dd className="mt-1">
                      <StatusBadge status={event.status} />
                    </dd>
                  </div>
                </dl>
                {(event.capabilities.canCancel || event.capabilities.canDelete) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    {event.capabilities.canCancel && event.status !== 'CANCELLED' && (
                      <Button
                        size="sm"
                        variant="warning"
                        onClick={() => setConfirmation({ event, action: 'cancel' })}
                      >
                        <XCircle className="size-4" />
                        {t('cancelEvent')}
                      </Button>
                    )}
                    {event.capabilities.canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmation({ event, action: 'delete' })}
                      >
                        <Trash2 className="size-4" />
                        {t('deleteEvent')}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="bg-surface-sunken text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t('name')}</th>
                  <th className="px-4 py-3">{t('clientName')}</th>
                  <th className="px-4 py-3">{t('dateRange')}</th>
                  <th className="px-4 py-3">{t('creator')}</th>
                  <th className="px-4 py-3">{t('status', { ns: 'common' })}</th>
                  <th className="px-4 py-3">{t('operationalStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {events.data.items.map((event) => (
                  <tr
                    key={event.id}
                    className="border-t border-border align-middle hover:bg-muted/35"
                  >
                    <td className="px-4 py-4">
                      <Link
                        className="font-display text-lg hover:text-primary"
                        to={`/app/events/${event.id}`}
                      >
                        {event.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(`categories.${event.category}`)}
                      </p>
                    </td>
                    <td className="px-4 py-4">{event.client.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatRange(event)}</td>
                    <td className="px-4 py-4">
                      <p>
                        {event.createdBy.firstName} {event.createdBy.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{event.createdBy.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={event.operationalStatus} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        {event.capabilities.canCancel && event.status !== 'CANCELLED' && (
                          <Button
                            size="sm"
                            variant="warning"
                            onClick={() => setConfirmation({ event, action: 'cancel' })}
                          >
                            <XCircle className="size-4" />
                            {t('cancelEvent')}
                          </Button>
                        )}
                        {event.capabilities.canDelete && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirmation({ event, action: 'delete' })}
                          >
                            <Trash2 className="size-4" />
                            {t('deleteEvent')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={cursors.length === 1}
              onClick={() => setCursors((current) => current.slice(0, -1))}
            >
              <ChevronLeft className="size-4" />
              {t('previousPage')}
            </Button>
            <Button
              variant="secondary"
              disabled={!events.data.pageInfo.hasNextPage || !events.data.pageInfo.endCursor}
              onClick={() =>
                setCursors((current) => [...current, events.data?.pageInfo.endCursor ?? undefined])
              }
            >
              {t('nextPage')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={t('noEvents')}
          action={
            mayCreate && clientId ? (
              <Link to={`/app/events/new?clientId=${clientId}`}>
                <Button>{t('create')}</Button>
              </Link>
            ) : undefined
          }
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={t(confirmation?.action === 'delete' ? 'deleteEventTitle' : 'cancelEventTitle')}
        description={t(
          confirmation?.action === 'delete' ? 'deleteEventDescription' : 'cancelEventDescription',
        )}
        confirmLabel={t(confirmation?.action === 'delete' ? 'deleteEvent' : 'cancelEvent')}
        tone={confirmation?.action === 'delete' ? 'danger' : 'warning'}
        loading={action.isPending}
        onClose={() => {
          if (!action.isPending) setConfirmation(null);
        }}
        onConfirm={() => confirmation && action.mutate(confirmation)}
      >
        {confirmation && (
          <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold">
            {t('selectedEvent', { name: confirmation.event.name })}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function formatRange(event: EventSummary): string {
  if (!event.startAt) return '—';
  const formatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: event.timezone ?? 'UTC',
  });
  return `${formatter.format(new Date(event.startAt))}${event.endAt ? ` – ${formatter.format(new Date(event.endAt))}` : ''}`;
}
