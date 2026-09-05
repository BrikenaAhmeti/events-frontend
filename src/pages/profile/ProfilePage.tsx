import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { Skeleton } from '../../components/atoms/Skeleton';
import { FormField } from '../../components/molecules/FormField';
import { PageHeader } from '../../components/molecules/PageHeader';
import { useToast } from '../../app/providers/toast-provider';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { authKeys } from '../../lib/api/query-keys';
import type { CurrentUser } from '../../types/domain';

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const passwordSchema = (message: string) =>
  z
    .object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(12),
      confirmation: z.string().min(12),
    })
    .refine(({ newPassword, confirmation }) => newPassword === confirmation, {
      path: ['confirmation'],
      message,
    });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<ReturnType<typeof passwordSchema>>;

export function ProfilePage() {
  const { t } = useTranslation('profile');
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const profile = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: '', lastName: '' },
  });
  const password = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema(t('passwordsMustMatch'))),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  useEffect(() => {
    if (user.data) {
      profile.reset({ firstName: user.data.firstName, lastName: user.data.lastName });
    }
  }, [profile, user.data]);

  const updateProfile = useMutation({
    mutationFn: (values: ProfileValues) => apiClient.patch<CurrentUser>('/auth/profile', values),
    onSuccess: (updated) => {
      queryClient.setQueryData(authKeys.me(), updated);
      showToast(t('profileUpdated'));
    },
  });
  const updatePassword = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      apiClient.post<void>('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      password.reset();
      showToast(t('passwordUpdated'));
    },
  });

  if (!user.data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 max-w-2xl" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const activeMemberships = user.data.memberships.filter(({ status }) => status === 'ACTIVE');
  const accessLabel = user.data.platformRole
    ? t('platformAdministrator')
    : activeMemberships.some(({ role }) => role === 'CLIENT_ADMIN')
      ? t('clientAdministrator')
      : t('clientStaff');

  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
            <h2 className="font-display text-2xl font-semibold">{t('personalTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('personalDescription')}
            </p>
            <form
              className="mt-6 grid gap-5 sm:grid-cols-2"
              onSubmit={(event) =>
                void profile.handleSubmit((values) => updateProfile.mutate(values))(event)
              }
            >
              <FormField
                label={t('common:firstName')}
                htmlFor="profile-first-name"
                error={profile.formState.errors.firstName?.message}
              >
                <Input id="profile-first-name" {...profile.register('firstName')} />
              </FormField>
              <FormField
                label={t('common:lastName')}
                htmlFor="profile-last-name"
                error={profile.formState.errors.lastName?.message}
              >
                <Input id="profile-last-name" {...profile.register('lastName')} />
              </FormField>
              <FormField label={t('common:email')} htmlFor="profile-email">
                <Input id="profile-email" value={user.data.email} readOnly disabled />
              </FormField>
              <div className="flex items-end">
                <Button type="submit" loading={updateProfile.isPending}>
                  {t('common:save')}
                </Button>
              </div>
              {updateProfile.error && (
                <p className="text-sm text-danger sm:col-span-2" role="alert">
                  {updateProfile.error.message}
                </p>
              )}
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
            <h2 className="font-display text-2xl font-semibold">{t('securityTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('securityDescription')}
            </p>
            <form
              className="mt-6 max-w-xl space-y-5"
              onSubmit={(event) =>
                void password.handleSubmit((values) => updatePassword.mutate(values))(event)
              }
            >
              <FormField
                label={t('currentPassword')}
                htmlFor="current-password"
                error={password.formState.errors.currentPassword?.message}
              >
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  {...password.register('currentPassword')}
                />
              </FormField>
              <FormField
                label={t('newPassword')}
                htmlFor="new-password"
                hint={t('passwordMinimum')}
                error={password.formState.errors.newPassword?.message}
              >
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  {...password.register('newPassword')}
                />
              </FormField>
              <FormField
                label={t('confirmPassword')}
                htmlFor="confirm-password"
                error={password.formState.errors.confirmation?.message}
              >
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...password.register('confirmation')}
                />
              </FormField>
              {updatePassword.error && (
                <p className="text-sm text-danger" role="alert">
                  {updatePassword.error.message}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" loading={updatePassword.isPending}>
                  {t('updatePassword')}
                </Button>
                <Link
                  className="text-sm font-semibold underline underline-offset-4"
                  to="/forgot-password"
                >
                  {t('sendReset')}
                </Link>
              </div>
            </form>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-sidebar p-5 text-sidebar-foreground">
          <ShieldCheck className="size-7" aria-hidden />
          <h2 className="mt-5 font-display text-xl font-semibold">{t('accessTitle')}</h2>
          <Badge className="mt-3 border-sidebar-foreground text-sidebar-foreground">
            {accessLabel}
          </Badge>
          <p className="mt-4 text-sm text-muted-foreground">
            {t('activeWorkspaces', { count: activeMemberships.length })}
          </p>
        </aside>
      </div>
    </div>
  );
}
