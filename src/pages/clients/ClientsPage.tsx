import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { EmptyState } from '../../components/molecules/EmptyState';
import { FormField } from '../../components/molecules/FormField';
import { PageHeader } from '../../components/molecules/PageHeader';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { useToast } from '../../app/providers/toast-provider';
import { apiClient } from '../../lib/api/api-client';
import { clientKeys } from '../../lib/api/query-keys';
import type { Client, Page } from '../../types/domain';

const schema = z.object({
  name: z.string().min(2),
  contactEmail: z.union([z.literal(''), z.email()]),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminEmail: z.email(),
});
type Values = z.infer<typeof schema>;

export function ClientsPage() {
  const { t } = useTranslation('clients');
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const clients = useQuery({
    queryKey: clientKeys.list(),
    queryFn: ({ signal }) => apiClient.get<Page<Client>>('/clients', signal),
    enabled: user?.platformRole === 'SUPER_ADMIN',
  });
  if (user && user.platformRole !== 'SUPER_ADMIN') return <Navigate to="/app/forbidden" replace />;
  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {t('add')}
          </Button>
        }
      />
      {clients.data?.items.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>{t('organization')}</span>
            <span>{t('events')}</span>
            <span>{t('staff')}</span>
            <span>{t('status')}</span>
          </div>
          {clients.data.items.map((client) => (
            <Link
              key={client.id}
              to={`/app/clients/${client.id}`}
              className="grid gap-3 border-b border-border px-5 py-5 transition hover:bg-muted/45 last:border-0 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] md:items-center"
            >
              <div>
                <p className="font-display text-xl">{client.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{client.contactEmail}</p>
              </div>
              <p className="text-sm">
                <span className="md:hidden">{t('events')}: </span>
                {client._count?.events ?? 0}
              </p>
              <p className="text-sm">
                <span className="md:hidden">{t('staff')}: </span>
                {client._count?.memberships ?? 0}
              </p>
              <div>
                <StatusBadge status={client.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        !clients.isLoading && (
          <EmptyState
            icon={Building2}
            title={t('empty')}
            action={<Button onClick={() => setOpen(true)}>{t('add')}</Button>}
          />
        )
      )}
      <CreateClientDialog open={open} close={() => setOpen(false)} />
    </div>
  );
}

function CreateClientDialog({ open, close }: { open: boolean; close: () => void }) {
  const { t } = useTranslation('clients');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      contactEmail: '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
    },
  });
  const create = useMutation({
    mutationFn: (values: Values) =>
      apiClient.post<Client>('/clients', {
        name: values.name,
        contactEmail: values.contactEmail || undefined,
        admin: {
          firstName: values.adminFirstName,
          lastName: values.adminLastName,
          email: values.adminEmail,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.all });
      showToast(t('created'));
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
      aria-labelledby="client-dialog-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="client-dialog-title" className="font-display text-2xl">
            {t('add')}
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
          onSubmit={(event) => void form.handleSubmit((values) => create.mutate(values))(event)}
        >
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label={t('name')}
                htmlFor="client-name"
                error={form.formState.errors.name?.message}
              >
                <Input id="client-name" {...form.register('name')} />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField
                label={t('contact')}
                htmlFor="client-contact"
                error={form.formState.errors.contactEmail?.message}
              >
                <Input id="client-contact" type="email" {...form.register('contactEmail')} />
              </FormField>
            </div>
            <p className="border-t border-border pt-5 text-sm font-bold sm:col-span-2">
              {t('admin')}
            </p>
            <FormField
              label={t('firstName', { ns: 'common' })}
              htmlFor="admin-first"
              error={form.formState.errors.adminFirstName?.message}
            >
              <Input id="admin-first" {...form.register('adminFirstName')} />
            </FormField>
            <FormField
              label={t('lastName', { ns: 'common' })}
              htmlFor="admin-last"
              error={form.formState.errors.adminLastName?.message}
            >
              <Input id="admin-last" {...form.register('adminLastName')} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField
                label={t('email', { ns: 'common' })}
                htmlFor="admin-email"
                error={form.formState.errors.adminEmail?.message}
              >
                <Input id="admin-email" type="email" {...form.register('adminEmail')} />
              </FormField>
            </div>
            {create.error && (
              <p className="text-sm text-danger sm:col-span-2" role="alert">
                {create.error.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-4">
            <Button type="button" variant="quiet" onClick={close}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t('add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
