import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, FileText, Paperclip, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Input, Select, Textarea } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import {
  AssistantMessage as ChatBubble,
  TypingIndicator as TypingBubble,
  UserMessage as UserChatBubble,
} from '../../components/molecules/ChatMessage';
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
  message?: string;
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

type SetupStart = {
  clientId: string;
  clientName: string;
  message: string;
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
  const chatLogRef = useRef<HTMLDivElement>(null);
  const defaultClient = params.get('clientId') ?? (user ? activeClientId(user) : '') ?? '';
  const [selectedClientId, setSelectedClientId] = useState(defaultClient);
  const [confirmedClientId, setConfirmedClientId] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewed, setReviewed] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [selectedClientMessage, setSelectedClientMessage] = useState('');
  const [submittedSource, setSubmittedSource] = useState('');
  const [submittedFileName, setSubmittedFileName] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const [nameDecision, setNameDecision] = useState<'accepted' | 'pending' | 'rejected'>('pending');
  const [analyzedContent, setAnalyzedContent] = useState<
    Pick<SetupAnalysis, 'facts' | 'schedule' | 'extractedFacts' | 'extractedScheduleItems'>
  >({ facts: [], schedule: [], extractedFacts: 0, extractedScheduleItems: 0 });
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const clientId = user ? (isSuperAdmin ? confirmedClientId : defaultClient) : '';
  const setupReady = Boolean(clientId);
  const mayCreate = Boolean(user && can(user, 'EVENT_CREATE', clientId));
  const clients = useQuery({
    queryKey: isSuperAdmin ? ['event-client-directory'] : clientKeys.list(),
    queryFn: async ({ signal }) => {
      if (isSuperAdmin) return apiClient.get<Client[]>('/events/directory/clients', signal);
      return (await apiClient.get<Page<Client>>('/clients', signal)).items;
    },
    enabled: Boolean(user),
  });
  const start = useMutation({
    mutationFn: (nextClientId: string) =>
      apiClient.post<SetupStart>('/events/setup/start', {
        clientId: nextClientId,
      }),
    onSuccess: (result) => {
      setConfirmedClientId(result.clientId);
      setSetupMessage(result.message);
    },
  });
  const analyze = useMutation({
    mutationFn: () =>
      apiClient.form<SetupAnalysis>(
        '/events/setup/analyze',
        { clientId, ...(source.trim() ? { text: source.trim() } : {}) },
        file ?? undefined,
      ),
    onMutate: () => {
      setSubmittedSource(source.trim());
      setSubmittedFileName(file?.name ?? '');
      setAnalysisMessage('');
    },
    onSuccess: (result) => {
      setDraft({
        ...emptyDraft,
        ...result.event,
        name: result.event.name ?? '',
        startAt: asLocalDateTime(result.event.startAt),
        endAt: asLocalDateTime(result.event.endAt),
      });
      setSuggestedName(result.suggestedName);
      setAnalysisMessage(result.message ?? t('reviewCompleteMessage'));
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
    setSelectedClientId(nextClientId);
    setConfirmedClientId('');
    setSetupMessage('');
    setSelectedClientMessage('');
    setSubmittedSource('');
    setSubmittedFileName('');
    setAnalysisMessage('');
    start.reset();
    analyze.reset();
    setDraft(emptyDraft);
    setReviewed(false);
    setSuggestedName('');
    setNameDecision('pending');
    setAnalyzedContent({
      facts: [],
      schedule: [],
      extractedFacts: 0,
      extractedScheduleItems: 0,
    });
  };
  const saveClient = () => {
    const selectedClient = clients.data?.find((client) => client.id === selectedClientId);
    setSelectedClientMessage(selectedClient?.name ?? t('client'));
    start.mutate(selectedClientId);
  };
  const submitBrief = () => {
    if (!setupReady || analyze.isPending || reviewed || (!source.trim() && !file)) return;
    analyze.mutate();
  };
  const handleBriefSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitBrief();
  };
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitBrief();
  };
  const canSubmit =
    Boolean(clientId && draft.name.trim().length >= 2 && draft.category) &&
    nameDecision === 'accepted';
  const draftCompleteness = evaluateDraft(draft);
  const composerDisabled = !setupReady || start.isPending || analyze.isPending || reviewed;
  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  }, [analysisMessage, analyze.isPending, nameDecision, reviewed, setupMessage, start.isPending]);
  if (user && !isSuperAdmin && defaultClient && !mayCreate)
    return <Navigate to="/app/forbidden" replace />;
  return (
    <div className="mx-auto max-w-6xl">
      <section
        className="flex h-[calc(100dvh-7.5rem)] min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:h-[calc(100dvh-4rem)]"
        aria-labelledby="event-setup-title"
      >
        <header className="border-b border-border bg-surface-sunken/45 px-4 py-3.5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {t('guidedSetup')}
          </p>
          <h1 id="event-setup-title" className="mt-1 font-display text-2xl">
            {t('createTitle')}
          </h1>
        </header>
        <div
          ref={chatLogRef}
          className="flex-1 space-y-5 overflow-y-auto bg-surface-sunken/20 p-4 sm:p-6"
          role="log"
          aria-live="polite"
          aria-label={t('setupConversation')}
        >
          {!isSuperAdmin && <ChatBubble>{t('setupWelcome')}</ChatBubble>}
          {isSuperAdmin && (
            <ChatBubble>
              <p className="mb-4 text-sm text-muted-foreground">{t('chooseClientPrompt')}</p>
              <FormField label={t('client')} htmlFor="setup-client">
                <Select
                  id="setup-client"
                  value={selectedClientId}
                  onChange={(event) => selectClient(event.target.value)}
                  disabled={start.isPending || analyze.isPending || create.isPending}
                >
                  <option value="">{t('selectClient')}</option>
                  {clients.data?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button
                className="mt-3"
                size="sm"
                loading={start.isPending}
                disabled={!selectedClientId || selectedClientId === confirmedClientId}
                onClick={saveClient}
              >
                <Check className="size-4" />
                {t('saveClientSelection')}
              </Button>
            </ChatBubble>
          )}
          {selectedClientMessage && (
            <UserChatBubble>
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {t('client')}
              </span>
              <span className="mt-1 block">{selectedClientMessage}</span>
            </UserChatBubble>
          )}
          {start.isPending && <TypingBubble label={t('preparingNextStep')} />}
          {setupMessage && <ChatBubble>{setupMessage}</ChatBubble>}
          {start.error && <ChatBubble danger>{start.error.message}</ChatBubble>}
          {(submittedSource || submittedFileName) && (
            <UserChatBubble>
              {submittedSource && <p className="whitespace-pre-wrap">{submittedSource}</p>}
              {submittedFileName && (
                <span className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs">
                  <FileText className="size-4" />
                  {submittedFileName}
                </span>
              )}
            </UserChatBubble>
          )}
          {analyze.isPending && <TypingBubble label={t('reviewingEventInformation')} />}
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
              {analysisMessage && <ChatBubble>{analysisMessage}</ChatBubble>}
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
                <ChatBubble wide>
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
        <form className="border-t border-border bg-surface p-3 sm:p-4" onSubmit={handleBriefSubmit}>
          <div
            className={`rounded-2xl border bg-background p-2 shadow-sm transition ${composerDisabled ? 'border-border opacity-65' : 'border-input focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/15'}`}
          >
            <label className="sr-only" htmlFor="event-source">
              {t('eventBrief')}
            </label>
            <Textarea
              id="event-source"
              className="max-h-28 !min-h-11 !resize-none border-0 bg-transparent px-2 py-2 focus:border-transparent"
              rows={1}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                !setupReady
                  ? t('saveClientBeforeWriting')
                  : reviewed
                    ? t('eventInformationReceived')
                    : t('eventBriefPlaceholder')
              }
              maxLength={80_000}
              disabled={composerDisabled}
            />
            {file && (
              <span className="mx-2 mb-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted px-3 text-xs text-foreground">
                <FileText className="size-4" />
                <span className="max-w-56 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label={t('removeFile')}
                  disabled={composerDisabled}
                >
                  <X className="size-4" />
                </button>
              </span>
            )}
            <div className="flex items-center gap-2 border-t border-border/70 px-1 pt-2">
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept=".pdf,.docx,.txt,.csv,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={composerDisabled}
              />
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                onClick={() => fileRef.current?.click()}
                aria-label={t('attachEventFile')}
                title={t('attachEventFile')}
                disabled={composerDisabled}
              >
                <Paperclip className="size-5" />
              </button>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {setupReady ? (reviewed ? t('continueAbove') : t('sendHint')) : ''}
              </span>
              <Button
                type="submit"
                size="sm"
                className="size-10 min-h-10 shrink-0 rounded-full px-0"
                disabled={composerDisabled || (!source.trim() && !file)}
                aria-label={t('sendSetupMessage')}
                title={t('sendSetupMessage')}
              >
                <Send className="size-4" />
                <span className="sr-only">{t('sendSetupMessage')}</span>
              </Button>
            </div>
          </div>
        </form>
      </section>
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
