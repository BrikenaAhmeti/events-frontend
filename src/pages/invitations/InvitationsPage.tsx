import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Mail, QrCode, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useOutletContext } from 'react-router-dom';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { EmptyState } from '../../components/molecules/EmptyState';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { invitationKeys } from '../../lib/api/query-keys';
import type { EventOutletContext } from '../events/EventLayout';

type Invitation = {
  id: string;
  status: string;
  type: string;
  expiresAt: string | null;
  sentAt: string | null;
  guest: { id: string; fullName: string; email: string } | null;
};
type InvitationList = { items: Invitation[]; summary: Record<string, number> };
type GeneralAccess = { url: string; qrSvg: string };

export function InvitationsPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('invitations');
  const { data: user } = useCurrentUser();
  const mayRead = Boolean(user && can(user, 'INVITATION_READ', event.clientId));
  const maySend = Boolean(user && (event.capabilities.canSendInvitations ?? event.capabilities.canEdit) && can(user, 'INVITATION_SEND', event.clientId));
  const mayRevoke = Boolean(user && (event.capabilities.canRevokeInvitations ?? event.capabilities.canEdit) && can(user, 'INVITATION_REVOKE', event.clientId));
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const invitations = useQuery({
    queryKey: invitationKeys.list(event.id),
    queryFn: ({ signal }) =>
      apiClient.get<InvitationList>(`/events/${event.id}/invitations`, signal),
    enabled: mayRead,
    refetchInterval: (query) =>
      query.state.data?.items.some(({ status }) => status === 'QUEUED') ? 4_000 : false,
  });
  const access = useQuery({
    queryKey: invitationKeys.access(event.id),
    queryFn: ({ signal }) =>
      apiClient.get<GeneralAccess>(`/events/${event.id}/invitations/general-access`, signal),
    enabled: mayRead && event.status === 'PUBLISHED',
    retry: false,
  });
  const qrData = useMemo(
    () =>
      access.data
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(access.data.qrSvg)}`
        : '',
    [access.data],
  );
  const send = useMutation({
    mutationFn: () => apiClient.post<{ queued: number }>(`/events/${event.id}/invitations/send`),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(event.id) });
      showToast(t('queued', { count: result.queued }));
    },
    onError: (error) => showToast(error.message, 'danger'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiClient.post(`/events/${event.id}/invitations/${id}/revoke`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(event.id) });
      setRevokeTarget(null);
      showToast(t('revoked'));
    },
  });
  const downloadQr = () => {
    if (!access.data) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([access.data.qrSvg], { type: 'image/svg+xml' }));
    link.download = `${event.slug}-qr.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (user && !mayRead) return <Navigate to="/app/forbidden" replace />;
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl">{t('title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {maySend && (
          <Button
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={event.status !== 'PUBLISHED'}
          >
            <Send className="size-4" />
            {t('send')}
          </Button>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <h3 className="mb-4 font-display text-2xl">{t('personal')}</h3>
          {invitations.data?.items.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {invitations.data.items.map((invitation) => (
                <article
                  key={invitation.id}
                  className="flex flex-col gap-3 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {invitation.guest?.fullName ?? t('generalInvitation')}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {invitation.guest?.email}
                    </p>
                  </div>
                  <StatusBadge status={invitation.status} />
                  {mayRevoke && !['REVOKED', 'ACCEPTED'].includes(invitation.status) && (
                    <Button size="sm" variant="quiet" onClick={() => setRevokeTarget(invitation)}>
                      {t('revoke')}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            !invitations.isLoading && <EmptyState icon={Mail} title={t('empty')} />
          )}
        </section>
        <aside className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
            {t('general')}
          </p>
          {access.data ? (
            <>
              <div className="mx-auto mt-5 aspect-square max-w-56 overflow-hidden rounded-xl border border-border bg-white p-3">
                <img className="size-full" src={qrData} alt={t('qrAlt', { event: event.name })} />
              </div>
              <p className="mt-4 break-all rounded-lg bg-surface-sunken p-3 text-xs text-muted-foreground">
                {access.data.url}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(access.data.url)
                      .then(() => showToast(t('copied')))
                  }
                >
                  <Link2 className="size-4" />
                  {t('copy')}
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadQr}>
                  <Download className="size-4" />
                  {t('download')}
                </Button>
              </div>
            </>
          ) : (
            <div className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">
              <span>
                <QrCode className="mx-auto mb-3 size-8" />
                {t('publishRequired')}
              </span>
            </div>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t('revoke')}
        description={t('revokeDescription', {
          name: revokeTarget?.guest?.fullName ?? t('thisGuest'),
        })}
        confirmLabel={t('revoke')}
        tone="danger"
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
      />
    </div>
  );
}
