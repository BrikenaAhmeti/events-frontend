import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, PencilLine, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { EmptyState } from '../../components/molecules/EmptyState';
import { FormField } from '../../components/molecules/FormField';
import { localDateTimeToUtc, localValue } from '../../components/organisms/EventDateRangeCard';
import { apiClient } from '../../lib/api/api-client';
import { eventKeys } from '../../lib/api/query-keys';
import type { ScheduleItem } from '../../types/domain';
import type { EventOutletContext } from './EventLayout';

type Draft = { title: string; description: string; startAt: string; endAt: string; location: string; category: string; visibility: 'SHARED' | 'STAFF' };
const emptyDraft: Draft = { title: '', description: '', startAt: '', endAt: '', location: '', category: '', visibility: 'SHARED' };

export function SchedulePage() {
  const { t } = useTranslation('events');
  const { event } = useOutletContext<EventOutletContext>();
  const timezone = event.timezone ?? 'UTC';
  const canEdit = event.capabilities.canEditSchedule ?? event.capabilities.canEdit;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<ScheduleItem | null | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState('');
  const days = event.schedule.reduce<Record<string, ScheduleItem[]>>((groups, item) => {
    const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(new Date(item.startAt));
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
  const save = useMutation({
    mutationFn: ({ itemId, data }: { itemId?: string; data: Record<string, unknown> }) =>
      itemId ? apiClient.patch(`/events/${event.id}/schedule/${itemId}`, data) : apiClient.post(`/events/${event.id}/schedule`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      showToast(t('scheduleSaved'));
      setEditing(undefined);
    },
    onError: (cause) => setError(cause.message),
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/events/${event.id}/schedule/${itemId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      showToast(t('scheduleDeleted'));
      setDeleteTarget(null);
    },
  });
  const openEditor = (item: ScheduleItem | null) => {
    setDraft(item ? {
      title: item.title, description: item.description ?? '',
      startAt: localValue(item.startAt, timezone), endAt: item.endAt ? localValue(item.endAt, timezone) : '',
      location: item.location ?? '', category: item.category ?? '',
      visibility: item.visibility === 'STAFF' ? 'STAFF' : 'SHARED',
    } : emptyDraft);
    setError('');
    setEditing(item);
  };
  const submit = () => {
    const startAt = localDateTimeToUtc(draft.startAt, timezone);
    const endAt = draft.endAt ? localDateTimeToUtc(draft.endAt, timezone) : null;
    if (!draft.title.trim() || !startAt || (draft.endAt && !endAt) || (endAt && endAt <= startAt)) {
      setError(t('scheduleInvalid'));
      return;
    }
    save.mutate({ itemId: editing?.id, data: {
      title: draft.title.trim(), description: draft.description.trim() || (editing ? null : undefined),
      startAt, endAt: endAt ?? (editing ? null : undefined),
      location: draft.location.trim() || (editing ? null : undefined),
      category: draft.category.trim() || (editing ? null : undefined), visibility: draft.visibility,
    } });
  };
  return <div className="space-y-6">
    {canEdit && <div className="flex justify-end"><Button onClick={() => openEditor(null)}><Plus className="size-4" />{t('addScheduleItem')}</Button></div>}
    {!event.schedule.length ? <EmptyState icon={CalendarClock} title={t('scheduleEmpty')} description={t('scheduleEmptyDescription')} /> :
      Object.entries(days).map(([day, items]) => <section key={day}>
        <h2 className="font-display text-3xl">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone }).format(new Date(items?.[0]?.startAt ?? day))}</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
          {items?.map((item) => <article key={item.id} className="grid gap-2 border-b border-border p-5 last:border-0 sm:grid-cols-[8rem_minmax(0,1fr)_12rem]">
            <time className="font-semibold text-primary">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(item.startAt))}</time>
            <div><h3 className="font-semibold">{item.title}</h3>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}{item.visibility === 'STAFF' && <p className="mt-1 text-xs text-muted-foreground">{t('staffOnly')}</p>}</div>
            <div className="flex flex-wrap items-start gap-2 sm:justify-end">
              {item.location && <p className="text-sm text-muted-foreground">{item.location}</p>}
              {canEdit && <><Button size="sm" variant="quiet" onClick={() => openEditor(item)}><PencilLine className="size-4" />{t('editScheduleItem')}</Button><Button size="sm" variant="quiet" onClick={() => setDeleteTarget(item)}><Trash2 className="size-4" />{t('deleteScheduleItem')}</Button></>}
            </div>
          </article>)}
        </div>
      </section>)}
    {editing !== undefined && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5"><h2 id="schedule-editor-title" className="font-display text-2xl">{editing ? t('editScheduleItem') : t('addScheduleItem')}</h2><button type="button" onClick={() => setEditing(undefined)} aria-label={t('close', { ns: 'common' })}><X className="size-5" /></button></div>
        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormField label={t('scheduleTitle')} htmlFor="schedule-title"><Input id="schedule-title" value={draft.title} onChange={(change) => setDraft({ ...draft, title: change.target.value })} /></FormField></div>
          <FormField label={t('startDateTime')} htmlFor="schedule-start"><Input id="schedule-start" type="datetime-local" value={draft.startAt} onChange={(change) => setDraft({ ...draft, startAt: change.target.value })} /></FormField>
          <FormField label={t('endDateTime')} htmlFor="schedule-end"><Input id="schedule-end" type="datetime-local" value={draft.endAt} onChange={(change) => setDraft({ ...draft, endAt: change.target.value })} /></FormField>
          <div className="sm:col-span-2"><FormField label={t('scheduleDescription')} htmlFor="schedule-description"><textarea id="schedule-description" rows={3} className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm" value={draft.description} onChange={(change) => setDraft({ ...draft, description: change.target.value })} /></FormField></div>
          <FormField label={t('scheduleLocation')} htmlFor="schedule-location"><Input id="schedule-location" value={draft.location} onChange={(change) => setDraft({ ...draft, location: change.target.value })} /></FormField>
          <FormField label={t('scheduleCategory')} htmlFor="schedule-category"><Input id="schedule-category" value={draft.category} onChange={(change) => setDraft({ ...draft, category: change.target.value })} /></FormField>
          <FormField label={t('scheduleVisibility')} htmlFor="schedule-visibility"><select id="schedule-visibility" className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm" value={draft.visibility} onChange={(change) => setDraft({ ...draft, visibility: change.target.value as Draft['visibility'] })}><option value="SHARED">{t('sharedWithGuests')}</option><option value="STAFF">{t('staffOnly')}</option></select></FormField>
          <p className="self-end text-sm text-muted-foreground">{timezone}</p>
          {error && <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-border p-4"><Button variant="quiet" onClick={() => setEditing(undefined)}>{t('cancel', { ns: 'common' })}</Button><Button loading={save.isPending} onClick={submit}>{t('saveScheduleItem')}</Button></div>
      </div>
    </div>}
    <ConfirmDialog open={Boolean(deleteTarget)} title={t('deleteScheduleTitle')} description={t('deleteScheduleDescription', { title: deleteTarget?.title ?? '' })} confirmLabel={t('deleteScheduleItem')} tone="danger" loading={remove.isPending} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}>{remove.error && <p role="alert" className="mt-3 text-sm text-danger">{remove.error.message}</p>}</ConfirmDialog>
  </div>;
}
