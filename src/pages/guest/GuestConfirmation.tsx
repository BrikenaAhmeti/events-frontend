import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { AssistantMessage } from '../../components/molecules/ChatMessage';
import { FormField } from '../../components/molecules/FormField';

export type GuestIdentity = { fullName: string; email: string };

export function GuestConfirmation({ onConfirm, pending, error }: {
  onConfirm: (identity: GuestIdentity) => void;
  pending: boolean;
  error: boolean;
}) {
  const { t } = useTranslation('guest');
  const [details, setDetails] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-surface-raised p-5">
      <h2 className="font-display text-2xl">{t('enterTitle')}</h2>
      <AssistantMessage><p>{t('confirmTogether')}</p></AssistantMessage>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        const emails = details.match(/[^\s<>;,]+@[^\s<>;,]+/g) ?? [];
        const email = emails[0]?.toLowerCase() ?? '';
        const fullName = details.replace(emails[0] ?? '', '').replace(/^[\s,;<>]+|[\s,;<>]+$/g, '').trim();
        if (emails.length !== 1 || !z.email().safeParse(email).success || fullName.length < 2 || fullName.length > 200) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        if (!pending) onConfirm({ fullName, email });
      }}>
        <FormField label={t('identityMessage')} htmlFor="guest-identity" error={invalid ? t('identityInvalid') : undefined}>
          <Input id="guest-identity" value={details} onChange={(event) => setDetails(event.target.value)}
            placeholder={t('identityExample')} maxLength={460} required disabled={pending} />
        </FormField>
        {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">{t('notRecognized')}</p>}
        <Button className="w-full" type="submit" loading={pending}>{t('enter')}</Button>
      </form>
    </section>
  );
}
