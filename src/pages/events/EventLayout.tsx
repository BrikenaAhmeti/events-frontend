import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, LayoutDashboard, Link2, MessageCircle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Skeleton } from '../../components/atoms/Skeleton';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { eventKeys } from '../../lib/api/query-keys';
import type { EventDetail } from '../../types/domain';

export type EventOutletContext = { event: EventDetail };

export function EventLayout() {
  const { t } = useTranslation('events');
  const { eventId = '' } = useParams();
  const { data: user } = useCurrentUser();
  const event = useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: ({ signal }) => apiClient.get<EventDetail>(`/events/${eventId}`, signal),
    enabled: Boolean(eventId),
  });
  if (event.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  if (!event.data) return null;
  const tabs = [
    ['', t('overview'), LayoutDashboard, 'EVENT_READ'],
    ['concierge', t('concierge'), MessageCircle, 'EVENT_READ'],
    ['guests', t('guests'), Users, 'GUEST_READ'],
    ['documents', t('documents'), FileText, 'EVENT_READ'],
    ['invitations', t('invitations'), Link2, 'INVITATION_READ'],
    ['schedule', t('schedule'), CalendarDays, 'EVENT_READ'],
  ] as const;
  return (
    <div>
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-primary">
              {t(`categories.${event.data.category}`)}
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">
              {event.data.name}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              {event.data.startAt
                ? new Intl.DateTimeFormat('en', {
                    dateStyle: 'long',
                    timeZone: event.data.timezone ?? 'UTC',
                  }).format(new Date(event.data.startAt))
                : t('datesPending')}{' '}
              · {event.data.destination ?? event.data.venue ?? t('locationPending')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={event.data.status} />
            <StatusBadge status={event.data.operationalStatus} />
            <span className="text-sm font-bold tabular-nums">
              {t('readinessPercent', { score: event.data.completeness.score })}
            </span>
          </div>
        </div>
      </header>
      <nav
        aria-label={t('workspaceLabel')}
        className="my-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 sm:grid-cols-3 xl:grid-cols-6"
      >
        {tabs
          .filter(([, , , permission]) => user && can(user, permission, event.data.clientId))
          .map(([path, label, Icon]) => (
            <NavLink
              key={path}
              end={!path}
              to={path}
              className={({ isActive }) =>
                `flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
      </nav>
      <Outlet context={{ event: event.data } satisfies EventOutletContext} />
    </div>
  );
}
