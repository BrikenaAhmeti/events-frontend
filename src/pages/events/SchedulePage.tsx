import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { EmptyState } from '../../components/molecules/EmptyState';
import type { ScheduleItem } from '../../types/domain';
import type { EventOutletContext } from './EventLayout';

export function SchedulePage() {
  const { t } = useTranslation('events');
  const { event } = useOutletContext<EventOutletContext>();
  const days = event.schedule.reduce<Record<string, ScheduleItem[]>>((groups, item) => {
    const key = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: event.timezone ?? 'UTC',
    }).format(new Date(item.startAt));
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
  if (!event.schedule.length)
    return (
      <EmptyState
        icon={CalendarClock}
        title={t('scheduleEmpty')}
        description={t('scheduleEmptyDescription')}
      />
    );
  return (
    <div className="space-y-8">
      {Object.entries(days).map(([day, items]) => (
        <section key={day}>
          <h2 className="font-display text-3xl">
            {new Intl.DateTimeFormat('en', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              timeZone: event.timezone ?? 'UTC',
            }).format(new Date(items?.[0]?.startAt ?? day))}
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
            {items?.map((item) => (
              <article
                key={item.id}
                className="grid gap-2 border-b border-border p-5 last:border-0 sm:grid-cols-[8rem_minmax(0,1fr)_12rem]"
              >
                <time className="font-semibold text-primary">
                  {new Intl.DateTimeFormat('en', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: event.timezone ?? 'UTC',
                  }).format(new Date(item.startAt))}
                </time>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground sm:text-right">{item.location}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
