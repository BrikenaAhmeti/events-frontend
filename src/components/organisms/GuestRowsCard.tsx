import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../lib/api/api-client';
import { Button } from '../atoms/Button';

type GuestRow = { id: string; fullName: string; email: string; notes: string; saved: boolean };
const blankRow = (): GuestRow => ({ id: crypto.randomUUID(), fullName: '', email: '', notes: '', saved: false });

function GuestRowEditor({
  eventId, row, onChange, onSaved,
}: {
  eventId: string;
  row: GuestRow;
  onChange: (row: GuestRow) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('concierge');
  const save = useMutation({
    mutationFn: () => apiClient.post(`/events/${eventId}/guests`, {
      fullName: row.fullName.trim(), email: row.email.trim(),
      ...(row.notes.trim() ? { notes: row.notes.trim() } : {}),
    }),
    onSuccess: () => {
      onChange({ ...row, saved: true });
      onSaved();
    },
  });
  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-surface p-3"
      onSubmit={(event) => { event.preventDefault(); if (!row.saved) save.mutate(); }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          {t('guestFullName')}
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm"
            value={row.fullName}
            minLength={2}
            maxLength={200}
            required
            disabled={row.saved || save.isPending}
            onChange={(event) => onChange({ ...row, fullName: event.target.value })}
          />
        </label>
        <label className="text-xs font-semibold">
          {t('guestEmailRequired')}
          <input
            type="email"
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm"
            value={row.email}
            required
            disabled={row.saved || save.isPending}
            onChange={(event) => onChange({ ...row, email: event.target.value })}
          />
        </label>
      </div>
      <label className="text-xs font-semibold">
        {t('guestPrivateDetails')}
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
          value={row.notes}
          maxLength={5_000}
          placeholder={t('guestPrivateDetailsPlaceholder')}
          disabled={row.saved || save.isPending}
          onChange={(event) => onChange({ ...row, notes: event.target.value })}
        />
      </label>
      {save.error && <p role="alert" className="text-sm text-danger">{save.error.message}</p>}
      {row.saved
        ? <p className="text-sm font-semibold text-success">{t('guestSaved')}</p>
        : <Button type="submit" size="sm" loading={save.isPending}>{t('saveGuest')}</Button>}
    </form>
  );
}

export function GuestRowsCard({
  eventId, onSaved, onPendingChange,
}: {
  eventId: string;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t } = useTranslation('concierge');
  const [rows, setRows] = useState<GuestRow[]>(() => [blankRow()]);
  const update = (next: GuestRow) => setRows((current) =>
    current.map((row) => row.id === next.id ? next : row));
  useEffect(() => {
    onPendingChange(rows.some((row) => !row.saved &&
      Boolean(row.fullName.trim() || row.email.trim() || row.notes.trim())));
  }, [rows, onPendingChange]);
  return (
    <div className="space-y-3" aria-label={t('guestRowsTitle')}>
      <p className="font-semibold">{t('guestRowsTitle')}</p>
      <p className="text-xs text-muted-foreground">{t('guestPrivacyHelp')}</p>
      {rows.map((row) => <GuestRowEditor key={row.id} eventId={eventId} row={row} onChange={update} onSaved={onSaved} />)}
      <Button type="button" variant="secondary" size="sm" onClick={() => setRows((current) => [...current, blankRow()])}>
        {t('addAnotherGuest')}
      </Button>
    </div>
  );
}
