import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { guestImportRowSchema, type GuestImportPreview, type GuestImportRow } from './guest-import';

type Editable = { sourceRow: number; source: Record<string, string>; data: Partial<GuestImportRow>; included: boolean };
const fields = [
  ['fullName', 'Full name'], ['email', 'Email'], ['firstName', 'First name'],
  ['lastName', 'Last name'], ['company', 'Company'], ['jobTitle', 'Job title'],
  ['phone', 'Phone'], ['guestGroup', 'Guest group'], ['notes', 'Notes'],
  ['dietaryInformation', 'Dietary information'], ['accessibilityInformation', 'Accessibility information'],
  ['accommodation', 'Accommodation'], ['travelInformation', 'Travel information'],
] as const;

export function GuestImportDialog({ preview, close, confirm, loading, canSendNow, canSendOnPublish = false, sendDisabledReason, error }: {
  preview: GuestImportPreview;
  close: () => void;
  confirm: (rows: GuestImportRow[], sendNow: boolean) => void;
  loading: boolean;
  canSendNow: boolean;
  canSendOnPublish?: boolean;
  sendDisabledReason?: string;
  error?: string;
}) {
  const { t } = useTranslation('guests');
  const [rows, setRows] = useState<Editable[]>(() =>
    preview.rows?.map((row) => ({ sourceRow: row.row, source: row.values, data: row.data, included: !row.duplicate && row.errors.length === 0 }))
    ?? preview.validRows.map((row, index) => ({ sourceRow: index + 2, source: {}, data: row, included: true })),
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const reviewed = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((row) => {
      const parsed = guestImportRowSchema.safeParse(row.data);
      const errors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      const email = row.data.email?.trim().toLowerCase();
      if (row.included && email) {
        if (seen.has(email)) errors.push(t('duplicateInSelection'));
        seen.add(email);
      }
      return { ...row, errors, parsed: parsed.success ? parsed.data : null };
    });
  }, [rows, t]);
  const selected = reviewed.filter((row) => row.included);
  const ready = selected.length > 0 && selected.every((row) => row.parsed && row.errors.length === 0);
  const save = (sendNow: boolean) => {
    if (ready) confirm(selected.map((row) => row.parsed as GuestImportRow), sendNow);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="guest-import-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface-raised shadow-xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div><h2 id="guest-import-title" className="font-display text-2xl">{t('preview')}</h2>
            <p className="text-sm text-muted-foreground">{t('reviewRows', { count: rows.length })}</p></div>
          <Button type="button" variant="quiet" onClick={close} aria-label={t('close', { ns: 'common' })}>×</Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <p className="text-sm font-semibold">{t('selectedRows', { count: selected.length })}</p>
          {rows.slice(page * pageSize, (page + 1) * pageSize).map((row, pageIndex) => {
            const index = page * pageSize + pageIndex;
            const result = reviewed[index];
            return <div key={row.sourceRow} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={row.included} onChange={(event) => setRows((current) => current.map((item, position) => position === index ? { ...item, included: event.target.checked } : item))} />
                  {t('includeRow', { row: row.sourceRow })}
                </label>
                <Button type="button" variant="quiet" size="sm" onClick={() => setExpanded(expanded === index ? null : index)}>
                  {expanded === index ? t('hideDetails') : t('editDetails')}
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {fields.slice(0, expanded === index ? fields.length : 4).map(([key, label]) =>
                  <label key={key} className="text-xs font-semibold">{label}
                    <Input className="mt-1" type={key === 'email' ? 'email' : 'text'} value={row.data[key] ?? ''}
                      onChange={(event) => setRows((current) => current.map((item, position) => position === index ? { ...item, data: { ...item.data, [key]: event.target.value } } : item))} />
                  </label>,
                )}
              </div>
              {expanded === index && Object.keys(row.source).length > 0 &&
                <p className="mt-3 text-xs text-muted-foreground">{t('sourceValues')}: {Object.entries(row.source).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}
              {row.included && result && result.errors.length > 0 && <p role="alert" className="mt-2 text-xs text-danger">{result.errors.join(' · ')}</p>}
            </div>;
          })}
          {pageCount > 1 && <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="quiet" disabled={page === 0} onClick={() => { setPage(page - 1); setExpanded(null); }}>{t('previousRows')}</Button>
            <span className="text-sm">{t('rowsPage', { page: page + 1, count: pageCount })}</span>
            <Button type="button" variant="quiet" disabled={page >= pageCount - 1} onClick={() => { setPage(page + 1); setExpanded(null); }}>{t('nextRows')}</Button>
          </div>}
          {sendDisabledReason && <p className="text-sm text-muted-foreground">{sendDisabledReason}</p>}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="quiet" onClick={close}>{t('cancel', { ns: 'common' })}</Button>
          <Button type="button" variant="secondary" disabled={!ready} loading={loading} onClick={() => save(false)}>{t('addOnly')}</Button>
          {(canSendNow || canSendOnPublish) && <Button type="button" disabled={!ready} loading={loading} onClick={() => save(true)}>{canSendNow ? t('addAndSend') : t('addAndSendOnPublish')}</Button>}
        </div>
      </div>
    </div>
  );
}
