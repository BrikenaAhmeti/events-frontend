import { useTranslation } from 'react-i18next';
import { Badge } from '../atoms/Badge';

const tones: Record<string, string> = {
  ACTIVE: 'border-success/35 bg-success/10 text-success',
  ACCEPTED: 'border-success/35 bg-success/10 text-success',
  COMPLETED: 'border-success/35 bg-success/10 text-success',
  ONGOING: 'border-success/35 bg-success/10 text-success',
  PUBLISHED: 'border-success/35 bg-success/10 text-success',
  SENT: 'border-success/35 bg-success/10 text-success',
  CLIENT_ADMIN: 'border-info/35 bg-info/10 text-info',
  INVITED: 'border-info/35 bg-info/10 text-info',
  PROCESSING: 'border-info/35 bg-info/10 text-info',
  READY: 'border-info/35 bg-info/10 text-info',
  UPCOMING: 'border-info/35 bg-info/10 text-info',
  PENDING: 'border-warning/35 bg-warning/10 text-warning',
  QUEUED: 'border-warning/35 bg-warning/10 text-warning',
  UNSCHEDULED: 'border-warning/35 bg-warning/10 text-warning',
  CANCELLED: 'border-danger/35 bg-danger/10 text-danger',
  DISABLED: 'border-danger/35 bg-danger/10 text-danger',
  FAILED: 'border-danger/35 bg-danger/10 text-danger',
  REVOKED: 'border-danger/35 bg-danger/10 text-danger',
  DRAFT: 'border-foreground/30 bg-foreground/10 text-foreground',
  ARCHIVED: 'border-foreground/30 bg-foreground/10 text-foreground',
  PAST: 'border-foreground/30 bg-foreground/10 text-foreground',
};

export function StatusBadge({
  status,
  prominent = false,
}: {
  status: string;
  prominent?: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <Badge prominent={prominent} className={tones[status]}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}
