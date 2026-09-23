import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  loading = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'warning' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('common');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        if (loading) event.preventDefault();
        else onClose();
      }}
      onClose={() => {
        if (!loading) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface-raised p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-display text-2xl">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {children}
      </div>
      <div className="flex justify-end gap-3 border-t border-border p-4">
        <Button variant="quiet" disabled={loading} onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button variant={tone} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
