import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarDays, CircleDashed, Radio, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Skeleton } from '../../components/atoms/Skeleton';
import { EmptyState } from '../../components/molecules/EmptyState';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EventCard } from '../../components/organisms/EventCard';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient, ApiError } from '../../lib/api/api-client';
import type { EventSummary } from '../../types/domain';

type Dashboard = {
  metrics: {
    clients: number;
    activeClients: number;
    events: number;
    upcoming: number;
    drafts: number;
    published: number;
  };
  recentEvents: EventSummary[];
  recentActivity: Array<{ id: string; action: string; createdAt: string }>;
};

const metricIcons = [Building2, Users, CalendarDays, Radio, CircleDashed, CalendarDays];

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { data: user } = useCurrentUser();
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => apiClient.get<Dashboard>('/dashboard', signal),
  });
  const metricEntries = dashboard.data ? Object.entries(dashboard.data.metrics) : [];
  const canAddClient = user?.platformRole === 'SUPER_ADMIN';
  const clientId = user ? activeClientId(user) : undefined;
  const canCreateEvent = Boolean(user && can(user, 'EVENT_CREATE', clientId));
  return (
    <div>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('subtitle')}
        action={
          <div className="flex gap-2">
            {canAddClient && (
              <Link to="/app/clients">
                <Button variant="secondary">{t('addClient')}</Button>
              </Link>
            )}
            {canCreateEvent && (
              <Link to={`/app/events/new${clientId ? `?clientId=${clientId}` : ''}`}>
                <Button>{t('createEvent')}</Button>
              </Link>
            )}
          </div>
        }
      />
      {dashboard.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : dashboard.error ? (
        <EmptyState
          icon={CircleDashed}
          title={t('unavailable', { ns: 'common' })}
          description={dashboard.error instanceof ApiError
            ? `${dashboard.error.message}${dashboard.error.response.requestId
              ? ` · Request ID: ${dashboard.error.response.requestId}`
              : ''}`
            : dashboard.error.message}
          action={
            <Button onClick={() => void dashboard.refetch()}>{t('retry', { ns: 'common' })}</Button>
          }
        />
      ) : (
        <>
          <section
            aria-label={t('workspaceMetrics')}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            {metricEntries.map(([label, value], index) => {
              const Icon = metricIcons[index] ?? CalendarDays;
              return (
                <div key={label} className="rounded-xl border border-border bg-surface p-4">
                  <Icon className="size-4 text-primary" />
                  <p className="mt-5 text-3xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t(label)}
                  </p>
                </div>
              );
            })}
          </section>
          <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">{t('recentEvents')}</h2>
                <Link
                  to="/app/events"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  {t('viewAll')} <ArrowRight className="size-4" />
                </Link>
              </div>
              {dashboard.data?.recentEvents.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboard.data.recentEvents.slice(0, 4).map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title={t('noEvents')}
                  action={
                    canCreateEvent ? (
                      <Link to="/app/events/new">
                        <Button>{t('createEvent')}</Button>
                      </Link>
                    ) : undefined
                  }
                />
              )}
            </section>
            <aside>
              <h2 className="mb-4 font-display text-2xl">{t('activity')}</h2>
              <div className="rounded-xl border border-border bg-surface p-2">
                {dashboard.data?.recentActivity.map((item) => (
                  <div key={item.id} className="border-b border-border px-3 py-3 last:border-0">
                    <p className="text-sm font-semibold">
                      {item.action.toLowerCase().replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('en', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
