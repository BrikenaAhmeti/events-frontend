import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, PencilLine, Plus, Upload, UserRoundPlus, Users, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useOutletContext } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { EmptyState } from '../../components/molecules/EmptyState';
import { FormField } from '../../components/molecules/FormField';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { guestKeys } from '../../lib/api/query-keys';
import type { Page } from '../../types/domain';
import type { EventOutletContext } from '../events/EventLayout';

type Guest = {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  jobTitle: string | null;
  guestGroup: string | null;
};
type ImportRow = {
  fullName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  guestGroup?: string;
};
type ImportPreview = {
  mapping: Record<string, string | null>;
  validRows: ImportRow[];
  invalidRows: Array<{ row: number; errors: string[] }>;
  duplicates: Array<{ row: number; email: string }>;
  summary: { total: number; valid: number; invalid: number; duplicates: number };
};
const schema = z.object({
  fullName: z.string().min(2),
  email: z.email(),
  company: z.string(),
  guestGroup: z.string(),
});
type Values = z.infer<typeof schema>;

export function GuestsPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('guests');
  const { data: user } = useCurrentUser();
  const mayRead = Boolean(user && can(user, 'GUEST_READ', event.clientId));
  const mayManage = Boolean(user && (event.capabilities.canManageGuests ?? event.capabilities.canEdit) && can(user, 'GUEST_MANAGE', event.clientId));
  const mayImport = Boolean(user && (event.capabilities.canImportGuests ?? event.capabilities.canEdit) && can(user, 'GUEST_IMPORT', event.clientId));
  const guestColumns = mayManage
    ? 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.7fr)_9rem]'
    : 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.7fr)]';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const importInput = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Guest | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const guests = useQuery({
    queryKey: guestKeys.list(event.id),
    queryFn: ({ signal }) => apiClient.get<Page<Guest>>(`/events/${event.id}/guests`, signal),
    enabled: mayRead,
  });
  const previewImport = useMutation({
    mutationFn: (file: File) =>
      apiClient.upload<ImportPreview>(`/events/${event.id}/guests/imports/preview`, file),
    onSuccess: setPreview,
    onError: (error) => showToast(error.message, 'danger'),
  });
  const confirm = useMutation({
    mutationFn: (rows: ImportRow[]) =>
      apiClient.post<{ accepted: number; duplicates: number }>(
        `/events/${event.id}/guests/imports/confirm`,
        { rows },
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(event.id) });
      showToast(t('imported', { count: result.accepted }));
      setPreview(null);
    },
  });
  if (user && !mayRead) return <Navigate to="/app/forbidden" replace />;
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl">{t('title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={importInput}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) previewImport.mutate(file);
              event.target.value = '';
            }}
          />
          {mayImport && (
            <Button
              variant="secondary"
              loading={previewImport.isPending}
              onClick={() => importInput.current?.click()}
            >
              <Upload className="size-4" />
              {t('import')}
            </Button>
          )}
          {mayManage && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              {t('add')}
            </Button>
          )}
        </div>
      </div>
      {guests.data?.items.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className={`hidden gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid ${guestColumns}`}>
            <span>{t('fullName')}</span>
            <span>{t('email')}</span>
            <span>{t('company')}</span>
            <span>{t('group')}</span>
            {mayManage && <span className="text-right">{t('actions')}</span>}
          </div>
          {guests.data.items.map((guest) => (
            <article
              key={guest.id}
              className={`grid gap-1 border-b border-border px-5 py-4 last:border-0 md:items-center md:gap-4 ${guestColumns}`}
            >
              <p className="font-semibold">{guest.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">{guest.email}</p>
              <p className="text-sm text-muted-foreground">{guest.company ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{guest.guestGroup ?? '—'}</p>
              {mayManage && (
                <Button size="sm" variant="quiet" className="md:justify-self-end" onClick={() => setEditTarget(guest)}>
                  <PencilLine className="size-4" />
                  {t('edit')}
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        !guests.isLoading && (
          <EmptyState
            icon={Users}
            title={t('empty')}
            action={
              mayManage ? (
                <Button onClick={() => setAddOpen(true)}>
                  <UserRoundPlus className="size-4" />
                  {t('add')}
                </Button>
              ) : undefined
            }
          />
        )
      )}
      {mayManage && (addOpen || editTarget) && (
        <GuestDialog
          open
          guest={editTarget}
          close={() => {
            setAddOpen(false);
            setEditTarget(null);
          }}
          eventId={event.id}
        />
      )}
      {mayImport && preview && (
        <ImportPreviewDialog
          preview={preview}
          close={() => setPreview(null)}
          confirm={() => confirm.mutate(preview.validRows)}
          loading={confirm.isPending}
        />
      )}
    </div>
  );
}

function GuestDialog({
  open,
  close,
  eventId,
  guest,
}: {
  open: boolean;
  close: () => void;
  eventId: string;
  guest: Guest | null;
}) {
  const { t } = useTranslation('guests');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: guest?.fullName ?? '',
      email: guest?.email ?? '',
      company: guest?.company ?? '',
      guestGroup: guest?.guestGroup ?? '',
    },
  });
  const save = useMutation({
    mutationFn: (values: Values) =>
      guest
        ? apiClient.patch(`/events/${eventId}/guests/${guest.id}`, {
            ...values,
            company: values.company || undefined,
            guestGroup: values.guestGroup || undefined,
          })
        : apiClient.post(`/events/${eventId}/guests`, {
            ...values,
            company: values.company || undefined,
            guestGroup: values.guestGroup || undefined,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) });
      showToast(guest ? t('updated') : t('added'));
      form.reset();
      close();
    },
  });
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-guest-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="add-guest-title" className="font-display text-2xl">
            {guest ? t('edit') : t('add')}
          </h2>
          <button
            type="button"
            onClick={close}
            className="grid size-10 place-items-center rounded-lg hover:bg-muted"
            aria-label={t('close', { ns: 'common' })}
          >
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label={t('fullName')} htmlFor="guest-name">
                <Input id="guest-name" {...form.register('fullName')} />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label={t('email')} htmlFor="guest-email">
                <Input id="guest-email" type="email" {...form.register('email')} />
              </FormField>
            </div>
            <FormField label={t('company')} htmlFor="guest-company">
              <Input id="guest-company" {...form.register('company')} />
            </FormField>
            <FormField label={t('group')} htmlFor="guest-group">
              <Input id="guest-group" {...form.register('guestGroup')} />
            </FormField>
            {save.error && (
              <p className="text-sm text-danger sm:col-span-2" role="alert">
                {save.error.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button type="button" variant="quiet" onClick={close}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {guest ? t('save') : t('add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportPreviewDialog({
  preview,
  close,
  confirm,
  loading,
}: {
  preview: ImportPreview;
  close: () => void;
  confirm: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation('guests');
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 id="preview-title" className="font-display text-2xl">
              {t('preview')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('reviewMapping')}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid size-10 place-items-center rounded-lg hover:bg-muted"
            aria-label={t('close', { ns: 'common' })}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="rounded-xl bg-success/10 p-4">
            <p className="text-2xl font-bold text-success">{preview.summary.valid}</p>
            <p className="text-sm">{t('accepted', { count: preview.summary.valid })}</p>
          </div>
          <div className="rounded-xl bg-warning/10 p-4">
            <p className="text-2xl font-bold text-warning">{preview.summary.invalid}</p>
            <p className="text-sm">{t('attention', { count: preview.summary.invalid })}</p>
          </div>
          <div className="rounded-xl bg-surface-sunken p-4">
            <p className="text-2xl font-bold">{preview.summary.duplicates}</p>
            <p className="text-sm">{t('duplicatesSkipped')}</p>
          </div>
          <div className="sm:col-span-3">
            <h3 className="mb-2 text-sm font-bold">{t('columnMapping')}</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.mapping).map(([source, target]) => (
                <span
                  key={source}
                  className="rounded-full border border-border px-3 py-1.5 text-xs"
                >
                  <strong>{source}</strong> → {target ?? t('ignored')}
                </span>
              ))}
            </div>
          </div>
          {preview.invalidRows.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm sm:col-span-3">
              {preview.invalidRows.slice(0, 20).map((row) => (
                <p key={row.row}>
                  {t('rowError', { row: row.row, errors: row.errors.join(', ') })}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-border p-4">
          <Button variant="quiet" onClick={close}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button onClick={confirm} loading={loading} disabled={preview.validRows.length === 0}>
            <FileSpreadsheet className="size-4" />
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
