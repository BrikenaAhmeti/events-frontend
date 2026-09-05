import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { apiClient } from '../../lib/api/api-client';
import { authKeys } from '../../lib/api/query-keys';
import type { CurrentUser } from '../../types/domain';
import { AuthShell } from './AuthShell';

const createSchema = (message: string) =>
  z
    .object({ password: z.string().min(12), confirmation: z.string().min(12) })
    .refine(({ password, confirmation }) => password === confirmation, {
      path: ['confirmation'],
      message,
    });
type Values = z.infer<ReturnType<typeof createSchema>>;

export function ActivationPage({ recovery = false }: { recovery?: boolean }) {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(createSchema(t('passwordsMustMatch'))),
    defaultValues: { password: '', confirmation: '' },
  });
  const activation = useMutation({
    mutationFn: ({ password }: Values) =>
      apiClient.post<CurrentUser>(
        recovery ? '/auth/reset-password' : '/auth/activate',
        { tokenHash: params.get('token_hash') ?? '', password },
        { skipRefresh: true },
      ),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user);
      void navigate('/app/dashboard', { replace: true });
    },
  });
  return (
    <AuthShell>
      <div className="mt-12 rounded-2xl border border-border bg-surface-raised p-6 sm:p-9 lg:mt-0">
        <h1 className="font-display text-4xl">
          {recovery ? t('resetTitle') : t('activationTitle')}
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">{t('activationDescription')}</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => void form.handleSubmit((values) => activation.mutate(values))(event)}
        >
          <FormField
            label={t('newPassword')}
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
          </FormField>
          <FormField
            label={t('confirmPassword')}
            htmlFor="confirmation"
            error={form.formState.errors.confirmation?.message}
          >
            <Input
              id="confirmation"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmation')}
            />
          </FormField>
          {activation.error && (
            <p className="text-sm text-danger" role="alert">
              {activation.error.message}
            </p>
          )}
          <Button className="w-full" type="submit" loading={activation.isPending}>
            {recovery ? t('savePassword') : t('activate')}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
