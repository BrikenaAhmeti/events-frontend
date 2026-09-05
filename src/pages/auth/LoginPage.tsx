import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { apiClient, ApiError } from '../../lib/api/api-client';
import { authKeys } from '../../lib/api/query-keys';
import type { CurrentUser } from '../../types/domain';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.email(), password: z.string().min(8) });
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: (values: Values) =>
      apiClient.post<CurrentUser>('/auth/login', values, { skipRefresh: true }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me(), user);
      const state: unknown = location.state;
      const destination =
        typeof state === 'object' && state && 'from' in state && typeof state.from === 'string'
          ? state.from
          : '/app/dashboard';
      void navigate(destination, { replace: true });
    },
  });
  return (
    <AuthShell>
      <div className="mt-12 rounded-2xl border border-border bg-surface-raised p-6 sm:p-9 lg:mt-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {t('eventWorkspace')}
        </p>
        <h2 className="mt-3 font-display text-4xl">{t('welcome')}</h2>
        <p className="mt-3 leading-7 text-muted-foreground">{t('intro')}</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => void form.handleSubmit((values) => login.mutate(values))(event)}
          noValidate
        >
          <FormField
            label={t('email')}
            htmlFor="email"
            error={form.formState.errors.email?.message}
          >
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField
            label={t('password')}
            htmlFor="password"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          </FormField>
          {login.error && (
            <p
              className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-sm text-danger"
              role="alert"
            >
              {login.error instanceof ApiError ? login.error.message : t('invalid')}
            </p>
          )}
          <Button className="w-full" type="submit" size="lg" loading={login.isPending}>
            {login.isPending ? t('signingIn') : t('signIn')}
          </Button>
        </form>
        <Link
          to="/forgot-password"
          className="mt-6 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('forgot')}
        </Link>
      </div>
    </AuthShell>
  );
}
