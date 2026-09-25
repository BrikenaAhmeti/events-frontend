import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Plus, Upload, UserRoundPlus, Users, X } from 'lucide-react';
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
import { GuestImportDialog } from '../../features/guests/GuestImportDialog';
import { downloadGuestTemplate, type GuestImportPreview, type GuestImportRow } from '../../features/guests/guest-import';
import { apiClient } from '../../lib/api/api-client';
import { uploadDirectly } from '../../lib/api/direct-upload';
import { MAX_FUNCTION_UPLOAD_BYTES } from '../../lib/api/upload-limits';
import { uploadSizeError } from '../../lib/api/upload-limits';
import { guestKeys, invitationKeys } from '../../lib/api/query-keys';
import type { Page } from '../../types/domain';
import type { EventOutletContext } from '../events/EventLayout';

type Guest = {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  jobTitle: string | null;
  guestGroup: string | null;
  latestInvitation?: { id: string; status: string; sentAt: string | null } | null;
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
  const mayRead = Boolean(user && can(user, 'EVENT_READ', event.clientId));
  const mayManage = Boolean(user && (event.capabilities.canManageGuests ?? event.capabilities.canEdit));
  const mayImport = Boolean(user && (event.capabilities.canImportGuests ?? event.capabilities.canEdit));
  const maySend = Boolean(user && event.status === 'PUBLISHED' && (event.capabilities.canSendInvitations ?? event.capabilities.canEdit));
  const guestColumns = mayManage || maySend
    ? 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(12rem,auto)]'
    : 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.7fr)]';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const importInput = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Guest | null>(null);
  const [preview, setPreview] = useState<GuestImportPreview | null>(null);
  const guests = useInfiniteQuery({
    queryKey: guestKeys.list(event.id),
    queryFn: ({ signal, pageParam }) => apiClient.get<Page<Guest>>(`/events/${event.id}/guests${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    enabled: mayRead,
  });
  const guestItems = guests.data?.pages.flatMap((page) => page.items) ?? [];
  const previewImport = useMutation({
    mutationFn: async (file: File) => {
      if (file.size <= MAX_FUNCTION_UPLOAD_BYTES)
        return apiClient.upload<GuestImportPreview>(`/events/${event.id}/guests/imports/preview`, file);
      const ticket = await uploadDirectly(file, `/events/${event.id}/guests/imports/sign`);
      return apiClient.post<GuestImportPreview>(`/events/${event.id}/guests/imports/preview-upload`, { ticket });
    },
    onSuccess: setPreview,
    onError: (error) => showToast(error.message, 'danger'),
  });
  const confirm = useMutation({
    mutationFn: async ({ rows, sendNow }: { rows: GuestImportRow[]; sendNow: boolean }) => {
      const result = await apiClient.post<{ accepted: number; duplicates: number; guestIds: string[] }>(
        `/events/${event.id}/guests/imports/confirm`, { rows },
      );
      let invitationError: string | undefined;
      if (sendNow && result.guestIds?.length) {
        try { await apiClient.post(`/events/${event.id}/invitations/send`, { guestIds: result.guestIds }); }
        catch (error) { invitationError = error instanceof Error ? error.message : String(error); }
      }
      return { ...result, invitationError, sendNow };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(event.id) });
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(event.id) });
      showToast(result.invitationError ? t('importedInviteFailed', { count: result.accepted, error: result.invitationError }) : result.sendNow ? t('importedAndInvited', { count: result.accepted }) : t('imported', { count: result.accepted }), result.invitationError ? 'danger' : 'success');
      setPreview(null);
    },
  });
  const sendInvitations = useMutation({
    mutationFn: ({ guestId, resend }: { guestId?: string; resend?: boolean }) =>
      resend && guestId
        ? apiClient.post<{ queued: number }>(`/events/${event.id}/invitations/guests/${guestId}/resend`)
        : apiClient.post<{ queued: number }>(`/events/${event.id}/invitations/send`, guestId ? { guestIds: [guestId] } : {}),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(event.id) });
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(event.id) });
      showToast(t('invitationsQueued', { count: result.queued }));
    },
    onError: (error) => showToast(error.message, 'danger'),
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
          {mayImport && <>
            <Button variant="quiet" onClick={() => void downloadGuestTemplate('csv')}>{t('csvTemplate')}</Button>
            <Button variant="quiet" onClick={() => void downloadGuestTemplate('xlsx')}>{t('excelTemplate')}</Button>
          </>}
          <input
            ref={importInput}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                const error = uploadSizeError(file);
                if (error) showToast(error, 'danger');
                else previewImport.mutate(file);
              }
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
          {mayImport && <span className="self-center text-xs text-muted-foreground">{t('importLimit')}</span>}
          {mayManage && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              {t('add')}
            </Button>
          )}
          {maySend && <Button variant="secondary" loading={sendInvitations.isPending} onClick={() => sendInvitations.mutate({})}>{t('sendUnsent')}</Button>}
        </div>
      </div>
      {guests.isError && <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{guests.error.message}</p>}
      {guestItems.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className={`hidden gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid ${guestColumns}`}>
            <span>{t('fullName')}</span>
            <span>{t('email')}</span>
            <span>{t('company')}</span>
            <span>{t('group')}</span>
              {(mayManage || maySend) && <span className="text-right">{t('actions')}</span>}
          </div>
          {guestItems.map((guest) => (
            <article
              key={guest.id}
              className={`grid gap-1 border-b border-border px-5 py-4 last:border-0 md:items-center md:gap-4 ${guestColumns}`}
            >
              <p className="font-semibold">{guest.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">{guest.email}</p>
              <p className="text-sm text-muted-foreground">{guest.company ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{guest.guestGroup ?? '—'}</p>
              {(mayManage || maySend) && <div className="flex flex-wrap items-center gap-1 md:justify-self-end">
                {guest.latestInvitation && <span className="mr-1 text-xs text-muted-foreground">{t('invitationStatus', { status: guest.latestInvitation.status.toLowerCase() })}</span>}
                {maySend && !['QUEUED', 'ACCEPTED'].includes(guest.latestInvitation?.status ?? '') &&
                  <Button size="sm" variant="quiet" disabled={sendInvitations.isPending} onClick={() => sendInvitations.mutate({ guestId: guest.id, resend: guest.latestInvitation?.status === 'SENT' })}>
                    {guest.latestInvitation?.status === 'SENT' ? t('resendInvitation') : t('sendInvitation')}
                  </Button>}
                {mayManage && <Button size="sm" variant="quiet" onClick={() => setEditTarget(guest)}><PencilLine className="size-4" />{t('edit')}</Button>}
              </div>}
            </article>
          ))}
        </div>
      ) : (
        !guests.isLoading && !guests.isError && (
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
      {guests.hasNextPage && <div className="mt-4 text-center"><Button variant="secondary" loading={guests.isFetchingNextPage} onClick={() => void guests.fetchNextPage()}>{t('loadMore')}</Button></div>}
      {mayManage && (addOpen || editTarget) && (
        <GuestDialog
          open
          guest={editTarget}
          close={() => {
            setAddOpen(false);
            setEditTarget(null);
          }}
          eventId={event.id}
          sendOnAdd={maySend}
        />
      )}
      {mayImport && preview && (
        <GuestImportDialog
          preview={preview}
          close={() => setPreview(null)}
          confirm={(rows, sendNow) => confirm.mutate({ rows, sendNow })}
          loading={confirm.isPending}
          canSendNow={maySend}
          sendDisabledReason={!maySend ? event.status === 'PUBLISHED' ? t('invitationPermissionRequired') : t('invitationsAfterPublish') : undefined}
          error={confirm.error?.message}
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
  sendOnAdd,
}: {
  open: boolean;
  close: () => void;
  eventId: string;
  guest: Guest | null;
  sendOnAdd: boolean;
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
    mutationFn: async (values: Values) => {
      if (guest) return apiClient.patch<{ id: string }>(`/events/${eventId}/guests/${guest.id}`, {
            ...values,
            company: values.company || undefined,
            guestGroup: values.guestGroup || undefined,
          });
      const created = await apiClient.post<{ id: string }>(`/events/${eventId}/guests`, {
            ...values,
            company: values.company || undefined,
            guestGroup: values.guestGroup || undefined,
          });
      if (sendOnAdd) {
        try { await apiClient.post(`/events/${eventId}/invitations/send`, { guestIds: [created.id] }); }
        catch (error) { return { ...created, invitationError: error instanceof Error ? error.message : String(error) }; }
      }
      return created;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) });
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(eventId) });
      showToast('invitationError' in result ? t('addedInviteFailed', { error: result.invitationError }) : guest ? t('updated') : t('added'), 'invitationError' in result ? 'danger' : 'success');
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
