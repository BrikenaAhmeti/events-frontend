import { useTranslation } from 'react-i18next';
import { Badge } from '../atoms/Badge';

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('common');
  const tone =
    status === 'PUBLISHED' ||
    status === 'ACTIVE' ||
    status === 'COMPLETED' ||
    status === 'SENT' ||
    status === 'ACCEPTED' ||
    status === 'ONGOING'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'FAILED' ||
          status === 'DISABLED' ||
          status === 'REVOKED' ||
          status === 'CANCELLED'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : status === 'READY' ||
            status === 'PROCESSING' ||
            status === 'QUEUED' ||
            status === 'UPCOMING' ||
            status === 'UNSCHEDULED'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : '';
  return <Badge className={tone}>{t(`statuses.${status}`)}</Badge>;
}
