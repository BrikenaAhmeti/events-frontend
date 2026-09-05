import { useTranslation } from 'react-i18next';

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation('common');
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span
        className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none"
        aria-hidden
      />
      {label ?? t('loadingLabel')}
    </span>
  );
}
