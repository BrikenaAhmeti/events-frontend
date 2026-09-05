import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { apiClient } from '../../lib/api/api-client';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.email() });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const reset = useMutation({
    mutationFn: (values: Values) =>
      apiClient.post<{ message: string }>('/auth/forgot-password', values, { skipRefresh: true }),
  });
  return (
    <AuthShell>
      <div className="mt-12 rounded-2xl border border-border bg-surface-raised p-6 sm:p-9 lg:mt-0">
        <h1 className="font-display text-4xl">{t('resetTitle')}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">{t('resetDescription')}</p>
        {reset.isSuccess ? (
          <div className="mt-8 rounded-xl bg-success/10 p-4 text-sm text-success" role="status">
            {reset.data.message}
          </div>
        ) : (
          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => void form.handleSubmit((values) => reset.mutate(values))(event)}
          >
            <FormField
              label={t('email')}
              htmlFor="email"
              error={form.formState.errors.email?.message}
            >
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            </FormField>
            <Button className="w-full" type="submit" loading={reset.isPending}>
              {t('sendReset')}
            </Button>
          </form>
        )}
        <Link
          className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
          to="/login"
        >
          {t('backToSignIn')}
        </Link>
      </div>
    </AuthShell>
  );
}
