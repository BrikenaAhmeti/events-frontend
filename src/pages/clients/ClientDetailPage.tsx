import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Mail, PencilLine, Power, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useToast } from '../../app/providers/toast-provider';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Skeleton } from '../../components/atoms/Skeleton';
import { ConfirmDialog } from '../../components/molecules/ConfirmDialog';
import { FormField } from '../../components/molecules/FormField';
import { PageHeader } from '../../components/molecules/PageHeader';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { clientKeys } from '../../lib/api/query-keys';
import type { Client, EventSummary } from '../../types/domain';

type ClientDetail = Client & {
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    user: { id: string; firstName: string; lastName: string; email: string };
  }>;
  events: EventSummary[];
};

const settingsSchema = z.object({
  name: z.string().min(2),
  contactEmail: z.union([z.literal(''), z.email()]),
});
type SettingsValues = z.infer<typeof settingsSchema>;

export function ClientDetailPage() {
  const { t } = useTranslation('clients');
  const { clientId = '' } = useParams();
  const { data: user } = useCurrentUser();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mayView = Boolean(user && can(user, 'CLIENT_SETTINGS_MANAGE', clientId));
  const client = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: ({ signal }) => apiClient.get<ClientDetail>(`/clients/${clientId}`, signal),
    enabled: Boolean(clientId && mayView),
  });
  const statusUpdate = useMutation({
    mutationFn: (status: Client['status']) => apiClient.patch(`/clients/${clientId}`, { status }),
    onSuccess: (_, status) => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all });
      showToast(status === 'ACTIVE' ? t('activated') : t('deactivated'));
      setStatusOpen(false);
    },
    onError: (error) => showToast(error.message, 'danger'),
  });
  if (user && !mayView) return <Navigate to="/app/forbidden" replace />;
  if (client.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-80" />
      </div>
    );
  if (!client.data) return null;
  return (
    <div>
      <PageHeader
        eyebrow={t('workspace')}
        title={client.data.name}
        description={client.data.contactEmail ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
              <PencilLine className="size-4" />
              {t('edit')}
            </Button>
            {user?.platformRole === 'SUPER_ADMIN' && (
              <Button
                variant={client.data.status === 'ACTIVE' ? 'danger' : 'secondary'}
                onClick={() => setStatusOpen(true)}
              >
                <Power className="size-4" />
                {client.data.status === 'ACTIVE' ? t('deactivate') : t('activate')}
              </Button>
            )}
            {user && can(user, 'EVENT_CREATE', clientId) && (
              <Link to={`/app/events/new?clientId=${clientId}`}>
                <Button>{t('create', { ns: 'events' })}</Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{t('events')}</h2>
            <Link
              className="text-sm font-semibold text-primary"
              to={`/app/events?clientId=${clientId}`}
            >
              {t('viewAll', { ns: 'common' })}
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {client.data.events.map((event) => (
              <Link
                key={event.id}
                to={`/app/events/${event.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted"
              >
                <CalendarDays className="size-4 text-primary" />
                <span className="min-w-0 flex-1 truncate font-semibold">{event.name}</span>
                <StatusBadge status={event.status} />
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{t('team')}</h2>
            <Link
              className="text-sm font-semibold text-primary"
              to={`/app/team?clientId=${clientId}`}
            >
              {t('manage')}
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {client.data.memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <span className="grid size-9 place-items-center rounded-full bg-accent">
                  <Users className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {membership.user.firstName} {membership.user.lastName}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    {membership.user.email}
                  </p>
                </div>
                <StatusBadge status={membership.status} />
              </div>
            ))}
          </div>
        </section>
      </div>
      {settingsOpen && (
        <ClientSettingsDialog client={client.data} close={() => setSettingsOpen(false)} />
      )}
      <ConfirmDialog
        open={statusOpen}
        title={t('statusTitle')}
        description={
          client.data.status === 'ACTIVE'
            ? t('deactivateDescription', { name: client.data.name })
            : t('activateDescription', { name: client.data.name })
        }
        confirmLabel={client.data.status === 'ACTIVE' ? t('deactivate') : t('activate')}
        tone={client.data.status === 'ACTIVE' ? 'danger' : 'primary'}
        onClose={() => setStatusOpen(false)}
        onConfirm={() =>
          statusUpdate.mutate(client.data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
        }
      />
    </div>
  );
}

function ClientSettingsDialog({ client, close }: { client: Client; close: () => void }) {
  const { t } = useTranslation('clients');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: client.name, contactEmail: client.contactEmail ?? '' },
  });
  const update = useMutation({
    mutationFn: (values: SettingsValues) =>
      apiClient.patch(`/clients/${client.id}`, {
        name: values.name,
        contactEmail: values.contactEmail || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all });
      showToast(t('updated'));
      close();
    },
  });
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-settings-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="client-settings-title" className="font-display text-2xl">
            {t('edit')}
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
          <div className="space-y-5 p-5">
            <FormField label={t('name')} htmlFor="settings-name">
              <Input id="settings-name" {...form.register('name')} />
            </FormField>
            <FormField label={t('contact')} htmlFor="settings-contact">
              <Input id="settings-contact" type="email" {...form.register('contactEmail')} />
            </FormField>
            {update.error && (
              <p className="text-sm text-danger" role="alert">
                {update.error.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button type="button" variant="quiet" onClick={close}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
