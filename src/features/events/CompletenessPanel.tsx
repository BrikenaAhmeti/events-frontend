import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EventCompleteness } from '../../types/domain';

export function CompletenessPanel({ completeness }: { completeness: EventCompleteness }) {
  const { t } = useTranslation('events');
  return (
    <section
      className="rounded-xl border border-border bg-surface p-4"
      aria-labelledby="readiness-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t('readiness')}
          </p>
          <h2 id="readiness-title" className="mt-1 font-display text-lg">
            {completeness.ready ? t('ready') : t('missing', { count: completeness.missing.length })}
          </h2>
        </div>
        <span className="font-display text-2xl text-primary">{completeness.score}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${completeness.score}%` }}
        />
      </div>
      <div className="mt-4 space-y-2">
        {completeness.missing.map((field) => (
          <p key={field} className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-warning" />
            {t(`completenessFields.${field}`)}
          </p>
        ))}
        {completeness.ready && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" />
            {t('completenessReady')}
          </p>
        )}
      </div>
    </section>
  );
}
