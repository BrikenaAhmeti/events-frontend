import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Plus, RefreshCw, UserRoundX, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { EmptyState } from '../../components/molecules/EmptyState';
import { FormField } from '../../components/molecules/FormField';
import { PageHeader } from '../../components/molecules/PageHeader';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { teamKeys } from '../../lib/api/query-keys';
import type { Permission } from '../../types/domain';

type TeamMember = {
  id: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_STAFF';
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  invitedAt: string | null;
  joinedAt: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
  permissions: Array<{ permission: Permission }>;
};

const permissions: Array<{ value: Permission; label: string }> = [
  { value: 'EVENT_CREATE', label: 'canCreateEvents' },
  { value: 'EVENT_EDIT', label: 'canEditEvents' },
  { value: 'EVENT_DELETE', label: 'canDeleteOwnEvents' },
  { value: 'EVENT_PUBLISH', label: 'canPublishEvents' },
  { value: 'DOCUMENT_UPLOAD', label: 'canUploadDocuments' },
  { value: 'GUEST_MANAGE', label: 'canManageGuests' },
  { value: 'GUEST_IMPORT', label: 'canImportGuests' },
  { value: 'INVITATION_SEND', label: 'canSendInvitations' },
  { value: 'TEAM_READ', label: 'canViewTeam' },
];

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  permissions: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function TeamPage() {
  const { t } = useTranslation('team');
  const [params] = useSearchParams();
  const { data: user } = useCurrentUser();
  const clientId = params.get('clientId') ?? (user ? activeClientId(user) : undefined) ?? '';
  const mayRead = Boolean(user && can(user, 'TEAM_READ', clientId));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<TeamMember | null>(null);
  const [accessTarget, setAccessTarget] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const team = useQuery({
    queryKey: teamKeys.list(clientId),
    queryFn: ({ signal }) => apiClient.get<TeamMember[]>(`/clients/${clientId}/team`, signal),
    enabled: Boolean(clientId && mayRead),
  });
  const disable = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/clients/${clientId}/team/${id}`, { status: 'DISABLED' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.list(clientId) });
      showToast(t('disabled'));
      setDisableTarget(null);
    },
  });
  const resend = useMutation({
    mutationFn: (member: TeamMember) =>
      apiClient.post(`/clients/${clientId}/team/invitations`, {
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        permissions: member.permissions.map(({ permission }) => permission),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.list(clientId) });
      showToast(t('resendQueued'));
    },
  });
  const mayManage = Boolean(user && can(user, 'TEAM_MANAGE', clientId));
  if (user && !mayRead) return <Navigate to="/app/forbidden" replace />;
  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          mayManage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="size-4" />
              {t('invite')}
            </Button>
          ) : undefined
        }
      />
      {team.data?.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_0.7fr_1.4fr_0.7fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground lg:grid">
            <span>{t('member')}</span>
            <span>{t('role')}</span>
            <span>{t('permissions')}</span>
            <span>{t('joined')}</span>
            <span />
          </div>
          {team.data.map((member) => (
            <article
              key={member.id}
              className="grid gap-4 border-b border-border px-5 py-5 last:border-0 lg:grid-cols-[minmax(0,1.5fr)_0.7fr_1.4fr_0.7fr_auto] lg:items-center"
            >
              <div>
                <p className="font-semibold">
                  {member.user.firstName} {member.user.lastName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{member.user.email}</p>
              </div>
              <div>
                <StatusBadge status={member.role} />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {member.role === 'CLIENT_ADMIN'
                  ? t('fullAdministration')
                  : t('operationalPermissions', { count: member.permissions.length })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                  new Date(member.joinedAt ?? member.invitedAt ?? Date.now()),
                )}
              </p>
              {mayManage && member.role === 'CLIENT_STAFF' ? (
                <div className="flex flex-wrap justify-end gap-1">
                  <Button size="sm" variant="quiet" onClick={() => setAccessTarget(member)}>
                    <PencilLine className="size-4" />
                    {t('editAccess')}
                  </Button>
                  {member.status === 'INVITED' && (
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={resend.isPending && resend.variables?.id === member.id}
                      onClick={() => resend.mutate(member)}
                    >
                      <RefreshCw className="size-4" />
                      {t('resend')}
                    </Button>
                  )}
                  <Button size="sm" variant="quiet" onClick={() => setDisableTarget(member)}>
                    <UserRoundX className="size-4" />
                    {t('disable')}
                  </Button>
                </div>
              ) : (
                <span />
              )}
            </article>
          ))}
        </div>
      ) : (
        !team.isLoading && (
          <EmptyState
            icon={Users}
            title={t('empty')}
            action={
              mayManage ? (
                <Button onClick={() => setInviteOpen(true)}>{t('invite')}</Button>
              ) : undefined
            }
          />
        )
      )}
      <InviteDialog open={inviteOpen} close={() => setInviteOpen(false)} clientId={clientId} />
      {accessTarget && (
        <AccessDialog
          member={accessTarget}
          close={() => setAccessTarget(null)}
          clientId={clientId}
        />
      )}
      <ConfirmDialog
        open={Boolean(disableTarget)}
        title={t('disableTitle')}
        description={t('disableDescription', {
          name: disableTarget?.user.firstName ?? t('thisPerson'),
        })}
        confirmLabel={t('disable')}
        tone="danger"
        onClose={() => setDisableTarget(null)}
        onConfirm={() => disableTarget && disable.mutate(disableTarget.id)}
      />
    </div>
  );
}

function AccessDialog({
  member,
  close,
  clientId,
}: {
  member: TeamMember;
  close: () => void;
  clientId: string;
}) {
  const { t } = useTranslation('team');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const form = useForm<{ permissions: string[] }>({
    defaultValues: { permissions: member.permissions.map(({ permission }) => permission) },
  });
  const update = useMutation({
    mutationFn: ({ permissions: selected }: { permissions: string[] }) =>
      apiClient.patch(`/clients/${clientId}/team/${member.id}`, { permissions: selected }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.list(clientId) });
      showToast(t('accessUpdated'));
      close();
    },
  });
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="access-title" className="font-display text-2xl">
            {t('editAccess')}
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
        <form
          onSubmit={(event) => void form.handleSubmit((values) => update.mutate(values))(event)}
        >
          <fieldset className="grid gap-2 p-5 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">{t('operationalAccess')}</legend>
            {permissions.map(({ value, label }) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  value={value}
                  {...form.register('permissions')}
                  className="size-4 accent-primary"
                />
                {t(label)}
              </label>
            ))}
            {update.error && (
              <p className="text-sm text-danger sm:col-span-2" role="alert">
                {update.error.message}
              </p>
            )}
          </fieldset>
          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button variant="quiet" type="button" onClick={close}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {t('updateAccess')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteDialog({
  open,
  close,
  clientId,
}: {
  open: boolean;
  close: () => void;
  clientId: string;
}) {
  const { t } = useTranslation('team');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      permissions: permissions.slice(0, 6).map(({ value }) => value),
    },
  });
  const invite = useMutation({
    mutationFn: (values: Values) => apiClient.post(`/clients/${clientId}/team/invitations`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.list(clientId) });
      showToast(t('queued'));
      form.reset();
      close();
    },
  });
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="invite-title" className="font-display text-2xl">
            {t('invite')}
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
        <form
          onSubmit={(event) => void form.handleSubmit((values) => invite.mutate(values))(event)}
        >
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <FormField label={t('firstName', { ns: 'common' })} htmlFor="staff-first">
              <Input id="staff-first" {...form.register('firstName')} />
            </FormField>
            <FormField label={t('lastName', { ns: 'common' })} htmlFor="staff-last">
              <Input id="staff-last" {...form.register('lastName')} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField
                label={t('email', { ns: 'auth' })}
                htmlFor="staff-email"
                error={form.formState.errors.email?.message}
              >
                <Input id="staff-email" type="email" {...form.register('email')} />
              </FormField>
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-3 text-sm font-semibold">{t('operationalAccess')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      value={value}
                      {...form.register('permissions')}
                      className="size-4 accent-primary"
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </fieldset>
            {invite.error && (
              <p className="text-sm text-danger sm:col-span-2" role="alert">
                {invite.error.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button variant="quiet" type="button" onClick={close}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" loading={invite.isPending}>
              {t('invite')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
