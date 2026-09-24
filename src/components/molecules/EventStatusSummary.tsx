import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { EventSummary } from '../../types/domain';
import { StatusBadge } from './StatusBadge';

type Props = Pick<EventSummary, 'status' | 'operationalStatus'> & { className?: string };

export function EventStatusSummary({ status, operationalStatus, className }: Props) {
  const { t } = useTranslation('events');
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-sunken/55 px-2.5 py-2">
        <span className="text-xs font-bold text-foreground">{t('workflowStatus')}</span>
        <StatusBadge status={status} prominent />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-sunken/55 px-2.5 py-2">
        <span className="text-xs font-bold text-foreground">{t('operationalStatus')}</span>
        <StatusBadge status={operationalStatus} prominent />
      </div>
    </div>
  );
}
