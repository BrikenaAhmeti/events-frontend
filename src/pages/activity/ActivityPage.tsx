import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileClock,
  ListFilter,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { CustomSelect } from '../../components/molecules/CustomSelect';
import { DateTimePicker } from '../../components/molecules/DateTimePicker';
import { EmptyState } from '../../components/molecules/EmptyState';
import { PageHeader } from '../../components/molecules/PageHeader';
import { Skeleton } from '../../components/atoms/Skeleton';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { auditKeys } from '../../lib/api/query-keys';
import type { AuditActor, AuditLogEntry, Page } from '../../types/domain';

type AuditClient = { id: string; name: string };

export function ActivityPage() {
  const { t } = useTranslation('activity');
  const currentUser = useCurrentUser();
  const user = currentUser.data;
  const isSuperAdministrator = user?.platformRole === 'SUPER_ADMIN';
  const administratorMemberships =
    user?.memberships.filter(
      ({ role, status }) => role === 'CLIENT_ADMIN' && status === 'ACTIVE',
    ) ?? [];
  const mayView = Boolean(isSuperAdministrator || administratorMemberships.length > 0);
  const [clientId, setClientId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const rangeInvalid = Boolean(from && to && new Date(from) > new Date(to));
  const resetPage = () => setCursors([undefined]);
  const clients = useQuery({
    queryKey: auditKeys.clients(),
    queryFn: ({ signal }) => apiClient.get<AuditClient[]>('/audit-logs/directory/clients', signal),
    enabled: mayView,
  });
  const directoryQuery = clientId ? `?clientId=${clientId}` : '';
  const actors = useQuery({
    queryKey: auditKeys.actors(clientId),
    queryFn: ({ signal }) =>
      apiClient.get<AuditActor[]>(`/audit-logs/directory/actors${directoryQuery}`, signal),
    enabled: mayView,
  });
  const actions = useQuery({
    queryKey: auditKeys.actions(clientId),
    queryFn: ({ signal }) =>
      apiClient.get<string[]>(`/audit-logs/directory/actions${directoryQuery}`, signal),
    enabled: mayView,
  });
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({
          clientId,
          actorUserId,
          action,
          from: toIso(from),
          to: toIso(to),
          cursor: cursors.at(-1),
        }).filter(([, value]) => value),
      ) as Record<string, string>,
    [clientId, actorUserId, action, from, to, cursors],
  );
  const logs = useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: ({ signal }) =>
      apiClient.get<Page<AuditLogEntry>>(`/audit-logs?${new URLSearchParams(filters)}`, signal),
    enabled: mayView && !rangeInvalid,
  });

  if (currentUser.isLoading) return <Skeleton className="h-96" />;
  if (!mayView) return <Navigate to="/app/forbidden" replace />;

  const clearFilters = () => {
    setClientId('');
    setActorUserId('');
    setAction('');
    setFrom('');
    setTo('');
    resetPage();
  };
  const showClientFilter = isSuperAdministrator || (clients.data?.length ?? 0) > 1;

  return (
    <div>
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('subtitle')} />
      <section
        className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
        aria-label={t('filters')}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <ListFilter className="size-4.5" />
          </span>
          <div>
            <h2 className="font-display text-xl">{t('filters')}</h2>
            <p className="text-sm text-muted-foreground">{t('filterDescription')}</p>
          </div>
        </div>
        <div className={`grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:items-end ${
          showClientFilter
            ? 'xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(9rem,0.65fr)]'
            : 'xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(9rem,0.65fr)]'
        }`}>
          {showClientFilter && (
            <CustomSelect
              className="min-w-0"
              label={t('client')}
              icon={Building2}
              value={clientId}
              options={[
                {
                  value: '',
                  label: t(isSuperAdministrator ? 'allClients' : 'allManagedClients'),
                },
                ...(clients.data ?? []).map((client) => ({
                  value: client.id,
                  label: client.name,
                })),
              ]}
              onChange={(value) => {
                setClientId(value);
                setActorUserId('');
                setAction('');
                resetPage();
              }}
            />
          )}
          <CustomSelect
            className="min-w-0"
            label={t('teamMember')}
            icon={UserRound}
            value={actorUserId}
            options={[
              { value: '', label: t('allTeamMembers') },
              ...(actors.data ?? []).map((actor) => ({
                value: actor.id,
                label: `${actor.firstName} ${actor.lastName}`,
              })),
            ]}
            onChange={(value) => {
              setActorUserId(value);
              resetPage();
            }}
          />
          <CustomSelect
            className="min-w-0"
            label={t('action')}
            icon={Activity}
            value={action}
            options={[
              { value: '', label: t('allActions') },
              ...(actions.data ?? []).map((value) => ({
                value,
                label: formatAction(value),
              })),
            ]}
            onChange={(value) => {
              setAction(value);
              resetPage();
            }}
          />
          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {t('from')}
            </p>
            <DateTimePicker
              label={t('from')}
              value={from}
              onChange={(value) => {
                setFrom(value);
                resetPage();
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {t('to')}
            </p>
            <DateTimePicker
              label={t('to')}
              value={to}
              onChange={(value) => {
                setTo(value);
                resetPage();
              }}
            />
          </div>
          <Button className="filter-control min-h-12 whitespace-nowrap" variant="quiet" onClick={clearFilters}>
            {t('clearFilters')}
          </Button>
        </div>
        {rangeInvalid && (
          <p className="mt-3 text-sm font-semibold text-danger">{t('invalidRange')}</p>
        )}
      </section>
      {logs.isLoading ? (
        <Skeleton className="h-96" />
      ) : logs.isError ? (
        <EmptyState icon={FileClock} title={t('loadFailed')} description={logs.error.message} />
      ) : logs.data?.items.length ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-sunken/45 px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold">
                {t('resultCount', { count: logs.data.items.length })}
              </p>
              <p className="text-xs text-muted-foreground">{t('newestFirst')}</p>
            </div>
            <div className="divide-y divide-border">
              {logs.data.items.map((entry) => (
                <article
                  key={entry.id}
                  className="grid gap-4 px-4 py-5 transition-colors hover:bg-muted/30 sm:px-5 lg:grid-cols-[12rem_minmax(0,1fr)_15rem_15rem] lg:items-center"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <CalendarClock className="size-4" />
                    </span>
                    <time className="text-sm leading-5" dateTime={entry.createdAt}>
                      {formatTimestamp(entry.createdAt)}
                    </time>
                  </div>
                  <div className="min-w-0">
                    <span className={actionClass(entry.action)}>{formatAction(entry.action)}</span>
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {entry.event ? (
                        <Link
                          className="font-semibold text-foreground hover:text-primary"
                          to={`/app/events/${entry.event.id}`}
                        >
                          {entry.event.name}
                        </Link>
                      ) : (
                        entityDescription(entry, t('deletedRecord'))
                      )}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('performedBy')}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {entry.actor
                        ? `${entry.actor.firstName} ${entry.actor.lastName}`
                        : t('system')}
                    </p>
                    {entry.actor?.platformRole === 'SUPER_ADMIN' ? (
                      <p className="text-xs text-muted-foreground">{t('superAdmin')}</p>
                    ) : entry.actor?.platformRole === null && entry.actor.email ? (
                      <p className="truncate text-xs text-muted-foreground">{entry.actor.email}</p>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {t('client')}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {entry.client?.name ?? t('platform')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{entry.entityType}</p>
                  </div>
                </article>
              ))}
            </div>
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
              disabled={!logs.data.pageInfo.hasNextPage || !logs.data.pageInfo.endCursor}
              onClick={() =>
                setCursors((current) => [...current, logs.data?.pageInfo.endCursor ?? undefined])
              }
            >
              {t('nextPage')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <EmptyState icon={FileClock} title={t('empty')} description={t('emptyDescription')} />
      )}
    </div>
  );
}

function toIso(value: string): string {
  return value ? new Date(value).toISOString() : '';
}

function formatAction(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function entityDescription(entry: AuditLogEntry, deletedRecord: string): string {
  const storedName = entry.metadata.name;
  if (typeof storedName === 'string') return storedName;
  return entry.entityId ? `${entry.entityType} · ${entry.entityId.slice(0, 8)}` : deletedRecord;
}

function actionClass(action: string): string {
  const tone =
    action.includes('DELETED') || action.includes('DISABLED') || action.includes('REVOKED')
      ? 'bg-danger/10 text-danger'
      : action.includes('CREATED') || action.includes('ADDED') || action.includes('PUBLISHED')
        ? 'bg-success/10 text-success'
        : 'bg-accent text-accent-foreground';
  return `inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`;
}
