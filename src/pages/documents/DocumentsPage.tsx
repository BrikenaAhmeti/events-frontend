import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, FileText, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../../app/providers/toast-provider';
import { EmptyState } from '../../components/molecules/EmptyState';
import { StatusBadge } from '../../components/molecules/StatusBadge';
import { can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { apiClient } from '../../lib/api/api-client';
import { documentKeys } from '../../lib/api/query-keys';
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
const fileSize = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.ceil(bytes / 1_000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

export function DocumentsPage() {
  const { event } = useOutletContext<EventOutletContext>();
  const { t } = useTranslation('documents');
  const { data: user } = useCurrentUser();
  const mayUpload = Boolean(
    user && event.capabilities.canEdit && can(user, 'DOCUMENT_UPLOAD', event.clientId),
  );
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
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
    mutationFn: (file: File) => apiClient.upload(`/events/${event.id}/documents`, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(event.id) });
      showToast(t('uploaded'));
    },
    onError: (error) => showToast(error.message, 'danger'),
  });
  const choose = (files: FileList | null) => {
    const file = files?.[0];
    if (file) upload.mutate(file);
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
            choose(event.dataTransfer.files);
          }}
          disabled={!mayUpload}
          className={`grid min-h-52 w-full place-items-center rounded-2xl border border-dashed p-8 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${dragging ? 'border-primary bg-primary/5' : 'border-input bg-surface hover:border-primary/60'}`}
        >
          <span>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <UploadCloud className="size-5" />
            </span>
            <span className="mt-4 block font-semibold">
              {upload.isPending ? t('uploading') : mayUpload ? t('drop') : t('permissionRequired')}
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
            </article>
          ))}
          {documents.data?.length === 0 && <EmptyState icon={FileText} title={t('empty')} />}
        </div>
      </section>
      <aside className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-display text-xl">{t('safetyTitle')}</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('safetyDescription')}</p>
      </aside>
    </div>
  );
}
