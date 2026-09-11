import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, FileText, MessageCircle, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Input, Select, Textarea } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import { PageHeader } from '../../components/molecules/PageHeader';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { CompletenessPanel } from '../../features/events/CompletenessPanel';
import { apiClient } from '../../lib/api/api-client';
import { clientKeys } from '../../lib/api/query-keys';
import type { Client, EventCompleteness, EventSummary, Page } from '../../types/domain';

const categories = [
  'CORPORATE_INCENTIVE',
  'CONFERENCE',
  'CORPORATE_RETREAT',
  'WEDDING',
  'SPORTS_TRAVEL',
  'GROUP_TOUR',
  'MEETING',
  'OTHER',
] as const;

type Draft = {
  name: string;
  category: string;
  description: string;
  destination: string;
  venue: string;
  venueAddress: string;
  venueDetails: string;
  restroomInformation: string;
  accessibilityInformation: string;
  parkingInformation: string;
  wifiInformation: string;
  startAt: string;
  endAt: string;
  timezone: string;
  organizerName: string;
  organizerEmail: string;
};

type SetupAnalysis = {
  event: Partial<Draft>;
  suggestedName: string;
  nameWasProvided: boolean;
  completeness: EventCompleteness;
  facts: Array<{ key: string; value: string; confidence: number }>;
  schedule: Array<{
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    location?: string;
    category?: string;
  }>;
  extractedFacts: number;
  extractedScheduleItems: number;
  file: { name: string; size: number } | null;
};

const emptyDraft: Draft = {
  name: '',
  category: 'OTHER',
  description: '',
  destination: '',
  venue: '',
  venueAddress: '',
  venueDetails: '',
  restroomInformation: '',
  accessibilityInformation: '',
  parkingInformation: '',
  wifiInformation: '',
  startAt: '',
  endAt: '',
  timezone: '',
  organizerName: '',
  organizerEmail: '',
};

const asLocalDateTime = (value: string | undefined) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toISOString().slice(0, 16)
    : '';

const evaluateDraft = (draft: Draft): EventCompleteness => {
  const required: Array<[string, string]> = [
    ['name', draft.name],
    ['category', draft.category],
    ['description', draft.description],
    ['location', draft.destination || draft.venue],
    ['startAt', draft.startAt],
    ['endAt', draft.endAt],
    ['timezone', draft.timezone],
    ['organizerName', draft.organizerName],
    ['organizerEmail', draft.organizerEmail],
  ];
  const missing = required.filter(([, value]) => !value.trim()).map(([field]) => field);
  const warnings: string[] = [];
  if (draft.startAt && draft.endAt && new Date(draft.endAt) <= new Date(draft.startAt))
    warnings.push('endBeforeStart');
  if (draft.timezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: draft.timezone }).format();
    } catch {
      warnings.push('invalidTimezone');
    }
  }
  return {
    score: Math.round(((required.length - missing.length) / required.length) * 100),
    ready: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
    recommendations: [],
  };
};

export function CreateEventPage() {
  const { t } = useTranslation('events');
  const { data: user } = useCurrentUser();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const defaultClient = params.get('clientId') ?? (user ? activeClientId(user) : '') ?? '';
  const [clientId, setClientId] = useState(defaultClient);
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewed, setReviewed] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');
  const [nameDecision, setNameDecision] = useState<'accepted' | 'pending' | 'rejected'>('pending');
  const [analyzedContent, setAnalyzedContent] = useState<
    Pick<SetupAnalysis, 'facts' | 'schedule' | 'extractedFacts' | 'extractedScheduleItems'>
  >({ facts: [], schedule: [], extractedFacts: 0, extractedScheduleItems: 0 });
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const mayCreate = Boolean(user && can(user, 'EVENT_CREATE', clientId));
  const clients = useQuery({
    queryKey: isSuperAdmin ? ['event-client-directory'] : clientKeys.list(),
    queryFn: async ({ signal }) => {
      if (isSuperAdmin)
        return apiClient.get<Client[]>('/events/directory/clients', signal);
      return (await apiClient.get<Page<Client>>('/clients', signal)).items;
    },
    enabled: Boolean(user),
  });
  const analyze = useMutation({
    mutationFn: () =>
      apiClient.form<SetupAnalysis>(
        '/events/setup/analyze',
        { clientId, ...(source.trim() ? { text: source.trim() } : {}) },
        file ?? undefined,
      ),
    onSuccess: (result) => {
      setDraft({
        ...emptyDraft,
        ...result.event,
        name: result.event.name ?? '',
        startAt: asLocalDateTime(result.event.startAt),
        endAt: asLocalDateTime(result.event.endAt),
      });
      setSuggestedName(result.suggestedName);
      setNameDecision(result.nameWasProvided ? 'accepted' : 'pending');
      setAnalyzedContent({
        facts: result.facts ?? [],
        schedule: result.schedule ?? [],
        extractedFacts: result.extractedFacts,
        extractedScheduleItems: result.extractedScheduleItems,
      });
      setReviewed(true);
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const event = await apiClient.post<EventSummary>('/events', {
        clientId,
        ...Object.fromEntries(
          Object.entries(draft).filter(([, value]) => typeof value === 'string' && value.trim()),
        ),
        startAt: draft.startAt ? new Date(draft.startAt).toISOString() : undefined,
        endAt: draft.endAt ? new Date(draft.endAt).toISOString() : undefined,
        facts: analyzedContent.facts,
        schedule: analyzedContent.schedule,
      });
      if (file) await apiClient.upload(`/events/${event.id}/documents`, file);
      return event;
    },
    onSuccess: (event) => void navigate(`/app/events/${event.id}/concierge`),
  });
  const updateDraft = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const selectClient = (nextClientId: string) => {
    setClientId(nextClientId);
    setDraft(emptyDraft);
    setReviewed(false);
    setSuggestedName('');
    setNameDecision('pending');
    setAnalyzedContent({ facts: [], schedule: [], extractedFacts: 0, extractedScheduleItems: 0 });
  };
  const canSubmit =
    Boolean(clientId && draft.name.trim().length >= 2 && draft.category) &&
    nameDecision === 'accepted';
  const draftCompleteness = evaluateDraft(draft);
  if (user && !isSuperAdmin && defaultClient && !mayCreate)
    return <Navigate to="/app/forbidden" replace />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={t('setup')}
        title={t('createTitle')}
        description={t('createChatIntro')}
      />
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="border-b border-border bg-surface-sunken/45 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {t('guidedSetup')}
          </p>
          <h2 className="mt-2 font-display text-3xl">{t('tellConcierge')}</h2>
        </header>
        <div className="space-y-5 p-4 sm:p-6" aria-live="polite">
          <ChatBubble>{t('setupWelcome')}</ChatBubble>
          {isSuperAdmin && (
            <ChatBubble>
              <FormField label={t('client')} htmlFor="setup-client">
                <Select
                  id="setup-client"
                  value={clientId}
                  onChange={(event) => selectClient(event.target.value)}
                >
                  <option value="">{t('selectClient')}</option>
                  {clients.data?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </ChatBubble>
          )}
          <div className="ml-auto max-w-[94%] rounded-2xl rounded-br-md bg-primary p-4 text-primary-foreground sm:max-w-[82%]">
            <label className="text-sm font-semibold" htmlFor="event-source">
              {t('eventBrief')}
            </label>
            <Textarea
              id="event-source"
              className="mt-2 min-h-32 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/60"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={t('eventBriefPlaceholder')}
              maxLength={80_000}
            />
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.txt,.csv,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="size-4" />
                {t('attachEventFile')}
              </Button>
              {file && (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 text-xs">
                  <FileText className="size-4" />
                  {file.name}
                  <button type="button" onClick={() => setFile(null)} aria-label={t('removeFile')}>
                    <X className="size-4" />
                  </button>
                </span>
              )}
            </div>
          </div>
          {!reviewed && (
            <div className="flex justify-end">
              <Button
                size="lg"
                loading={analyze.isPending}
                disabled={!clientId || (!source.trim() && !file)}
                onClick={() => analyze.mutate()}
              >
                {t('reviewEventInformation')}
              </Button>
            </div>
          )}
          {analyze.error && (
            <ChatBubble danger>
              <p>{analyze.error.message}</p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setReviewed(true);
                  setNameDecision('rejected');
                }}
              >
                {t('enterManually')}
              </Button>
            </ChatBubble>
          )}
          {reviewed && (
            <>
              {nameDecision === 'pending' && (
                <ChatBubble>
                  <p className="font-semibold">{t('nameSuggestion')}</p>
                  <p className="mt-2 font-display text-2xl">{suggestedName}</p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateDraft('name', suggestedName);
                        setNameDecision('accepted');
                      }}
                    >
                      <Check className="size-4" />
                      {t('acceptName')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setNameDecision('rejected')}
                    >
                      {t('rejectName')}
                    </Button>
                  </div>
                </ChatBubble>
              )}
              {nameDecision === 'rejected' && (
                <ChatBubble>
                  <FormField label={t('provideEventName')} htmlFor="custom-event-name">
                    <Input
                      id="custom-event-name"
                      value={draft.name}
                      onChange={(event) => updateDraft('name', event.target.value)}
                    />
                  </FormField>
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={draft.name.trim().length < 2}
                    onClick={() => setNameDecision('accepted')}
                  >
                    {t('useThisName')}
                  </Button>
                </ChatBubble>
              )}
              {nameDecision === 'accepted' && (
                <ChatBubble>
                  <p className="flex items-center gap-2 font-semibold">
                    <Check className="size-4 text-success" />
                    {t('detailsReviewed')}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('completeMissingDetails')}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('analysisSummary', {
                      facts: analyzedContent.extractedFacts,
                      schedule: analyzedContent.extractedScheduleItems,
                    })}
                  </p>
                  <div className="mt-5">
                    <CompletenessPanel completeness={draftCompleteness} />
                  </div>
                  <EventDetailsForm draft={draft} update={updateDraft} />
                  {create.error && (
                    <p className="mt-4 text-sm text-danger">{create.error.message}</p>
                  )}
                  <Button
                    className="mt-6 w-full sm:w-auto"
                    size="lg"
                    loading={create.isPending}
                    disabled={!canSubmit}
                    onClick={() => create.mutate()}
                  >
                    {t('continue')}
                  </Button>
                </ChatBubble>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ChatBubble({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className={`max-w-[94%] rounded-2xl rounded-bl-md border p-4 sm:max-w-[86%] ${danger ? 'border-danger/30 bg-danger/10 text-danger' : 'border-border bg-surface-raised'}`}
    >
      <MessageCircle className="mb-3 size-5 text-primary" />
      {children}
    </div>
  );
}

function EventDetailsForm({
  draft,
  update,
}: {
  draft: Draft;
  update: (field: keyof Draft, value: string) => void;
}) {
  const { t } = useTranslation('events');
  const fields: Array<{ key: keyof Draft; label: string; type?: string; required?: boolean }> = [
    { key: 'name', label: t('name'), required: true },
    { key: 'description', label: t('description'), required: true },
    { key: 'destination', label: t('destination'), required: !draft.venue },
    { key: 'venue', label: t('venue'), required: !draft.destination },
    { key: 'venueAddress', label: t('venueAddress') },
    { key: 'startAt', label: t('startAt'), type: 'datetime-local', required: true },
    { key: 'endAt', label: t('endAt'), type: 'datetime-local', required: true },
    { key: 'timezone', label: t('timezone'), required: true },
    { key: 'organizerName', label: t('organizerName'), required: true },
    { key: 'organizerEmail', label: t('organizerEmail'), type: 'email', required: true },
  ];
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <FormField label={t('category')} htmlFor="setup-category">
        <Select
          id="setup-category"
          value={draft.category}
          onChange={(event) => update('category', event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category}`)}
            </option>
          ))}
        </Select>
      </FormField>
      {fields.map((field) => (
        <FormField
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          htmlFor={`setup-${field.key}`}
        >
          <Input
            id={`setup-${field.key}`}
            type={field.type}
            value={draft[field.key]}
            onChange={(event) => update(field.key, event.target.value)}
          />
        </FormField>
      ))}
      {(
        [
          ['venueDetails', t('venueDetails')],
          ['restroomInformation', t('restroomInformation')],
          ['accessibilityInformation', t('accessibilityInformation')],
          ['parkingInformation', t('parkingInformation')],
          ['wifiInformation', t('wifiInformation')],
        ] as Array<[keyof Draft, string]>
      ).map(([key, label]) => (
        <div key={key} className="sm:col-span-2">
          <FormField label={label} htmlFor={`setup-${key}`}>
            <Textarea
              id={`setup-${key}`}
              value={draft[key]}
              onChange={(event) => update(key, event.target.value)}
            />
          </FormField>
        </div>
      ))}
    </div>
  );
}
