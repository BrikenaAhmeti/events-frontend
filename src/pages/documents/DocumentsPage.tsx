import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, FileText, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../../app/providers/toast-provider';
import { EmptyState } from '../../components/molecules/EmptyState';
import { Button } from '../../components/atoms/Button';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { uploadDirectly } from '../../lib/api/direct-upload';
import { MAX_FUNCTION_UPLOAD_BYTES } from '../../lib/api/upload-limits';
import { uploadSizeError } from '../../lib/api/upload-limits';
import { documentKeys, eventKeys, guestKeys } from '../../lib/api/query-keys';
import type { EventOutletContext } from '../events/EventLayout';

type DocumentItem = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  processingStatus: string;
  processingError: string | null;
  createdAt: string;
};
type Extraction = {
  id: string;
  originalName: string;
  status: string;
  error: string | null;
  text: string;
  truncated: boolean;
  metadata: Record<string, unknown>;
};
const fileSize = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.ceil(bytes / 1_000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

export function DocumentsPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('documents');
  const { data: user } = useCurrentUser();
  const mayUpload = Boolean(
    user && can(user, 'DOCUMENT_UPLOAD', event.clientId) &&
    (event.capabilities.canUploadDocuments ?? event.capabilities.canEdit),
  );
  const changesClosed = event.status === 'CANCELLED' || event.status === 'ARCHIVED';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const extraction = useQuery({
    queryKey: ['document-extraction', event.id, selected?.id],
    queryFn: ({ signal }) => apiClient.get<Extraction>(`/events/${event.id}/documents/${selected?.id}/extraction`, signal),
    enabled: Boolean(selected),
  });
  const apply = useMutation({
    mutationFn: (text: string) => apiClient.post<{ message?: { content?: string }; addedGuests?: number }>(
      `/events/${event.id}/concierge/extract`, { text },
    ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(event.id) });
      showToast(result.message?.content ?? t('detailsApplied'));
      setSelected(null);
    },
  });
  const documents = useQuery({
    queryKey: documentKeys.list(event.id),
    queryFn: ({ signal }) => apiClient.get<DocumentItem[]>(`/events/${event.id}/documents`, signal),
    refetchInterval: (query) =>
      query.state.data?.some(({ processingStatus }) =>
        ['QUEUED', 'PROCESSING'].includes(processingStatus),
      )
        ? 3_000
        : false,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size <= MAX_FUNCTION_UPLOAD_BYTES)
        return apiClient.upload(`/events/${event.id}/documents`, file);
      const ticket = await uploadDirectly(file, `/events/${event.id}/documents/uploads/sign`);
      return apiClient.post(`/events/${event.id}/documents/uploads/complete`, { ticket });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(event.id) });
      showToast(t('uploaded'));
    },
    onError: (error) => showToast(error.message, 'danger'),
  });
  const choose = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const error = uploadSizeError(file);
    if (error) showToast(error, 'danger');
    else upload.mutate(file);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <div className="mb-5">
          <h2 className="font-display text-3xl">{t('title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.txt,.csv,.xlsx"
          className="sr-only"
          disabled={!mayUpload}
          onChange={(event) => {
            choose(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => mayUpload && input.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (mayUpload) choose(event.dataTransfer.files);
          }}
          disabled={!mayUpload}
          className={`grid min-h-52 w-full place-items-center rounded-2xl border border-dashed p-8 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${dragging ? 'border-primary bg-primary/5' : 'border-input bg-surface hover:border-primary/60'}`}
        >
          <span>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <UploadCloud className="size-5" />
            </span>
            <span className="mt-4 block font-semibold">
              {upload.isPending
                ? t('uploading')
                : mayUpload
                  ? t('drop')
                  : changesClosed
                    ? t('eventClosed')
                    : t('permissionRequired')}
            </span>
            <span className="mt-2 block text-sm text-muted-foreground">{t('formats')}</span>
          </span>
        </button>
        <div className="mt-6 space-y-3">
          {documents.data?.map((document) => (
            <article
              key={document.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-sunken">
                {document.processingStatus === 'COMPLETED' ? (
                  <FileCheck2 className="size-5 text-success" />
                ) : (
                  <FileText className="size-5 text-primary" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{document.originalName}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fileSize(document.size)} ·{' '}
                  {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                    new Date(document.createdAt),
                  )}
                </p>
              </div>
              <StatusBadge status={document.processingStatus} />
              <Button size="sm" variant="quiet" onClick={() => setSelected(document)}>{t('reviewText')}</Button>
              {document.processingStatus === 'FAILED' && document.processingError &&
                <p role="alert" className="text-xs text-danger">{document.processingError}</p>}
            </article>
          ))}
          {documents.data?.length === 0 && <EmptyState icon={FileText} title={t('empty')} />}
        </div>
      </section>
      <aside className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-display text-xl">{t('safetyTitle')}</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('safetyDescription')}</p>
      </aside>
      {selected && <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="document-review-title">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface-raised">
          <div className="flex items-center justify-between border-b border-border p-5"><h2 id="document-review-title" className="font-display text-2xl">{t('reviewTitle', { name: selected.originalName })}</h2><button type="button" onClick={() => setSelected(null)} aria-label={t('close', { ns: 'common' })}><X className="size-5" /></button></div>
          <div className="overflow-y-auto p-5">
            {extraction.isLoading && <p>{t('processing')}</p>}
            {extraction.isError && <p role="alert" className="text-danger">{extraction.error.message}</p>}
            {extraction.data?.error && <p role="alert" className="mb-3 text-danger">{extraction.data.error}</p>}
            {extraction.data?.text ? <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-4 text-sm">{extraction.data.text}</pre> : !extraction.isLoading && <p>{t('noReadableText')}</p>}
            {extraction.data?.truncated && <p className="mt-3 text-sm text-muted-foreground">{t('previewTruncated')}</p>}
            {apply.error && <p role="alert" className="mt-3 text-danger">{apply.error.message}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-border p-4"><Button variant="quiet" onClick={() => setSelected(null)}>{t('close', { ns: 'common' })}</Button>{event.capabilities.canEdit && extraction.data?.status === 'COMPLETED' && Boolean(extraction.data.text) && <Button loading={apply.isPending} disabled={extraction.data.truncated} onClick={() => apply.mutate(extraction.data?.text ?? '')}>{t('applyDetails')}</Button>}</div>
        </div>
      </div>}
    </div>
  );
}
