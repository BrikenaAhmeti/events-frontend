import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import { Textarea } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import {
  AssistantMessage as ChatBubble,
  TypingIndicator as TypingBubble,
  UserMessage as UserChatBubble,
} from '../../components/molecules/ChatMessage';
import { CustomSelect } from '../../components/molecules/CustomSelect';
import { DateTimePicker } from '../../components/molecules/DateTimePicker';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { CompletenessPanel } from '../../features/events/CompletenessPanel';
import { apiClient } from '../../lib/api/api-client';
import { clientKeys } from '../../lib/api/query-keys';
import type { Client, EventCompleteness, EventSummary, Page } from '../../types/domain';

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
  sessionId: string;
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
  template?: { kind: 'EVENT_BRIEF'; fileName: string };
  messages?: Array<{
    id: string;
    role: 'USER' | 'CONCIERGE';
    content: string;
  }>;
};

type SetupStart = {
  sessionId: string;
  clientId: string;
  clientName: string;
  resumed: boolean;
  messages: Array<{
    id: string;
    role: 'USER' | 'CONCIERGE';
    content: string;
    metadata?: { fileName?: string; setupTemplate?: 'EVENT_BRIEF' };
  }>;
  draft: {
    event: Partial<Draft>;
    facts: SetupAnalysis['facts'];
    schedule: SetupAnalysis['schedule'];
    suggestedName: string;
    nameWasProvided: boolean;
  };
};

type SetupConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  fileName?: string;
  template?: 'EVENT_BRIEF';
};

type SetupSubmission = {
  text: string;
  file: File | null;
  displayText?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
};

type GuidedSetupStep = 'basics' | 'dates' | 'location' | 'organizer' | 'details' | 'ready';

const emptyDraft: Draft = {
  name: '',
  category: '',
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const defaultClient = params.get('clientId') ?? (user ? activeClientId(user) : '') ?? '';
  const [selectedClientId, setSelectedClientId] = useState(defaultClient);
  const [confirmedClientId, setConfirmedClientId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewed, setReviewed] = useState(false);
  const [selectedClientMessage, setSelectedClientMessage] = useState('');
  const [conversation, setConversation] = useState<SetupConversationMessage[]>([]);
  const [analyzedContent, setAnalyzedContent] = useState<
    Pick<SetupAnalysis, 'facts' | 'schedule' | 'extractedFacts' | 'extractedScheduleItems'>
  >({ facts: [], schedule: [], extractedFacts: 0, extractedScheduleItems: 0 });
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';
  const clientId = user ? (isSuperAdmin ? confirmedClientId : defaultClient) : '';
  const setupReady = Boolean(clientId && sessionId);
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
    mutationFn: ({ nextClientId, restart = false }: { nextClientId: string; restart?: boolean }) =>
      apiClient.post<SetupStart>('/events/setup/start', { clientId: nextClientId, restart }),
    onSuccess: (result) => {
      setConfirmedClientId(result.clientId);
      setSessionId(result.sessionId);
      setConversation(
        result.messages.map((message) => ({
          id: message.id,
          role: message.role === 'USER' ? 'user' : 'assistant',
          text: message.content,
          fileName: message.metadata?.fileName,
          template: message.metadata?.setupTemplate,
        })),
      );
      const restored = result.draft;
      const restoredEvent = restored.event ?? {};
      setDraft({
        ...emptyDraft,
        ...Object.fromEntries(
          Object.entries(restoredEvent).filter(([, value]) => typeof value === 'string'),
        ),
        startAt: asLocalDateTime(restoredEvent.startAt),
        endAt: asLocalDateTime(restoredEvent.endAt),
      });
      const hasReviewedDetails = Object.values(restoredEvent).some(Boolean);
      setReviewed(hasReviewedDetails);
      setAnalyzedContent({
        facts: restored.facts ?? [],
        schedule: restored.schedule ?? [],
        extractedFacts: restored.facts?.length ?? 0,
        extractedScheduleItems: restored.schedule?.length ?? 0,
      });
      setSource('');
      setFile(null);
      requestAnimationFrame(() => composerRef.current?.focus());
    },
  });
  const analyze = useMutation({
    mutationFn: ({ text, file: submittedFile, startAt, endAt, timezone }: SetupSubmission) =>
      apiClient.form<SetupAnalysis>(
        '/events/setup/analyze',
        {
          clientId,
          sessionId,
          ...(text ? { text } : {}),
          ...(startAt ? { startAt } : {}),
          ...(endAt ? { endAt } : {}),
          ...(timezone ? { timezone } : {}),
        },
        submittedFile ?? undefined,
      ),
    onMutate: ({ text, displayText, file: submittedFile }) => {
      setConversation((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          ...(text ? { text: displayText ?? text } : {}),
          ...(submittedFile ? { fileName: submittedFile.name } : {}),
        },
      ]);
      setSource('');
      setFile(null);
    },
    onSuccess: (result) => {
      setDraft((current) => ({
        ...current,
        ...result.event,
        name: result.event.name ?? current.name,
        startAt: result.event.startAt ? asLocalDateTime(result.event.startAt) : current.startAt,
        endAt: result.event.endAt ? asLocalDateTime(result.event.endAt) : current.endAt,
      }));
      setAnalyzedContent({
        facts: result.facts ?? [],
        schedule: result.schedule ?? [],
        extractedFacts: result.extractedFacts,
        extractedScheduleItems: result.extractedScheduleItems,
      });
      if (!result.template) setReviewed(true);
      setConversation((current) => [
        ...current,
        {
          id:
            result.messages?.find((message) => message.role === 'CONCIERGE')?.id ??
            crypto.randomUUID(),
          role: 'assistant',
          text: result.message?.trim() || t('reviewCompleteMessage'),
          template: result.template?.kind,
        },
      ]);
    },
    onSettled: () => requestAnimationFrame(() => composerRef.current?.focus()),
  });
  const create = useMutation({
    mutationFn: async () => {
      const event = await apiClient.post<EventSummary>('/events', {
        clientId,
        setupSessionId: sessionId,
        ...Object.fromEntries(
          Object.entries(draft).filter(([, value]) => typeof value === 'string' && value.trim()),
        ),
        startAt: draft.startAt ? new Date(draft.startAt).toISOString() : undefined,
        endAt: draft.endAt ? new Date(draft.endAt).toISOString() : undefined,
        facts: analyzedContent.facts,
        schedule: analyzedContent.schedule,
      });
      return event;
    },
    onSuccess: (event) => void navigate(`/app/events/${event.id}/concierge`),
  });
  const selectClient = (nextClientId: string) => {
    setSelectedClientId(nextClientId);
    setConfirmedClientId('');
    setSessionId('');
    setSelectedClientMessage('');
    setConversation([]);
    setSource('');
    setFile(null);
    start.reset();
    analyze.reset();
    setDraft(emptyDraft);
    setReviewed(false);
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
    start.mutate({ nextClientId: selectedClientId });
  };
  const submitBrief = () => {
    const text = source.trim();
    if (!setupReady || analyze.isPending || (!text && !file)) return;
    analyze.mutate({
      text,
      file,
    });
  };
  const sendChoice = (text: string) => {
    if (!setupReady || analyze.isPending) return;
    analyze.mutate({ text, file: null });
  };
  const sendDates = (startAt: string, endAt: string, timezone: string) => {
    if (!setupReady || analyze.isPending) return;
    const startAtIso = new Date(startAt).toISOString();
    const endAtIso = new Date(endAt).toISOString();
    analyze.mutate({
      text: `Start date and time: ${startAtIso}\nEnd date and time: ${endAtIso}\nTimezone: ${timezone}`,
      displayText: `${formatDraftDate(startAt)} – ${formatDraftDate(endAt)} · ${timezone}`,
      file: null,
      startAt: startAtIso,
      endAt: endAtIso,
      timezone,
    });
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
  const draftCompleteness = evaluateDraft(draft);
  const canSubmit = Boolean(clientId && sessionId) && draftCompleteness.ready;
  const guidedStep = getGuidedSetupStep(draftCompleteness);
  const composerDisabled = !setupReady || start.isPending || analyze.isPending || create.isPending;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const conversationEnd = conversationEndRef.current;
      if (conversationEnd && typeof conversationEnd.scrollIntoView === 'function')
        conversationEnd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [analyze.isPending, conversation, reviewed, start.isPending]);
  useEffect(() => {
    if (!user || isSuperAdmin || !defaultClient || sessionId || start.status !== 'idle') return;
    start.mutate({ nextClientId: defaultClient });
  }, [defaultClient, isSuperAdmin, sessionId, start, user]);
  if (user && !isSuperAdmin && defaultClient && !mayCreate)
    return <Navigate to="/app/forbidden" replace />;
  return (
    <div className="mx-auto max-w-6xl">
      <section
        className="flex h-[calc(100dvh-7.5rem)] min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:h-[calc(100dvh-4rem)]"
        aria-labelledby="event-setup-title"
      >
        <header className="flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-border bg-surface-sunken/45 px-4 py-2 sm:px-5">
          <h1 id="event-setup-title" className="text-sm font-semibold text-foreground">
            {t('eventChatTitle')}
          </h1>
          {setupReady && (
            <Button
              size="sm"
              variant="secondary"
              disabled={start.isPending || analyze.isPending || create.isPending}
              onClick={() => start.mutate({ nextClientId: clientId, restart: true })}
            >
              <MessageSquarePlus className="size-4" />
              {t('startNewSetupChat')}
            </Button>
          )}
        </header>
        <div
          ref={chatLogRef}
          className="flex-1 space-y-5 overflow-y-auto bg-surface-sunken/20 p-4 sm:p-6"
          role="log"
          aria-live="polite"
          aria-label={t('setupConversation')}
        >
          {isSuperAdmin && (
            <ChatBubble>
              <p className="mb-4 text-sm text-muted-foreground">{t('chooseClientPrompt')}</p>
              <FormField label={t('client')} htmlFor="setup-client">
                <CustomSelect
                  id="setup-client"
                  label={t('client')}
                  value={selectedClientId}
                  options={[
                    { value: '', label: t('selectClient') },
                    ...(clients.data ?? []).map((client) => ({
                      value: client.id,
                      label: client.name,
                    })),
                  ]}
                  onChange={selectClient}
                  disabled={start.isPending || analyze.isPending || create.isPending}
                />
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
          {start.error && <ChatBubble danger>{start.error.message}</ChatBubble>}
          {conversation.map((message) =>
            message.role === 'assistant' ? (
              <ChatBubble key={message.id} wide={Boolean(message.template)}>
                {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                {message.template === 'EVENT_BRIEF' && <EventBriefTemplateCard />}
              </ChatBubble>
            ) : (
              <UserChatBubble key={message.id}>
                {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                {message.fileName && (
                  <span className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs">
                    <FileText className="size-4" />
                    {message.fileName}
                  </span>
                )}
              </UserChatBubble>
            ),
          )}
          {setupReady &&
            !reviewed &&
            !conversation.some((message) => message.role === 'user') &&
            !analyze.isPending && (
              <ChatBubble wide>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="group rounded-xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    onClick={() => sendChoice(t('stepByStepChoiceMessage'))}
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <MessageSquarePlus className="size-5" />
                    </span>
                    <span className="mt-3 block font-semibold">{t('stepByStepChoice')}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {t('stepByStepChoiceDescription')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="group rounded-xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    onClick={() => sendChoice(t('fileTemplateChoiceMessage'))}
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <FileText className="size-5" />
                    </span>
                    <span className="mt-3 block font-semibold">{t('fileTemplateChoice')}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {t('fileTemplateChoiceDescription')}
                    </span>
                  </button>
                </div>
              </ChatBubble>
            )}
          {analyze.isPending && <TypingBubble label={t('reviewingEventInformation')} />}
          {analyze.error && <ChatBubble danger>{analyze.error.message}</ChatBubble>}
          {reviewed && guidedStep === 'dates' && !analyze.isPending && (
            <ChatBubble wide>
              <EventDateResponseCard
                initialStartAt={draft.startAt}
                initialEndAt={draft.endAt}
                disabled={create.isPending}
                onSubmit={sendDates}
              />
            </ChatBubble>
          )}
          {reviewed && canSubmit && (
            <ChatBubble wide>
              <EventDraftSummary
                draft={draft}
                completeness={draftCompleteness}
                facts={analyzedContent.extractedFacts}
                schedule={analyzedContent.extractedScheduleItems}
                createError={create.error?.message}
                createPending={create.isPending}
                canSubmit={canSubmit}
                onCreate={() => create.mutate()}
              />
            </ChatBubble>
          )}
          <div ref={conversationEndRef} className="h-px" aria-hidden />
        </div>
        <form className="border-t border-border bg-surface p-3 sm:p-4" onSubmit={handleBriefSubmit}>
          <div
            className={`rounded-2xl border p-2 shadow-sm transition ${composerDisabled ? 'border-border bg-background opacity-65' : 'border-primary/35 bg-surface-raised focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/15'}`}
          >
            <label className="sr-only" htmlFor="event-source">
              {t('eventBrief')}
            </label>
            <Textarea
              ref={composerRef}
              id="event-source"
              className="chat-composer-input max-h-28 !min-h-11 !resize-none border-0 bg-transparent px-2 py-2"
              rows={1}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                !setupReady
                  ? t('saveClientBeforeWriting')
                  : reviewed
                    ? setupComposerPlaceholder(guidedStep, t)
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
                {setupReady ? (reviewed ? t('sendMoreHint') : t('sendHint')) : ''}
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

function EventDateResponseCard({
  initialStartAt,
  initialEndAt,
  disabled,
  onSubmit,
}: {
  initialStartAt: string;
  initialEndAt: string;
  disabled: boolean;
  onSubmit: (startAt: string, endAt: string, timezone: string) => void;
}) {
  const { t } = useTranslation('events');
  const [startAt, setStartAt] = useState(initialStartAt);
  const [endAt, setEndAt] = useState(initialEndAt);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const validRange = Boolean(
    startAt && endAt && new Date(endAt).getTime() > new Date(startAt).getTime(),
  );
  return (
    <div aria-label={t('chooseEventDates')}>
      <p className="text-sm font-semibold">{t('chooseEventDates')}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t('chooseEventDatesDescription', { timezone })}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label={t('startAt')} htmlFor="setup-start-at">
          <DateTimePicker
            id="setup-start-at"
            label={t('startAt')}
            value={startAt}
            onChange={setStartAt}
            disabled={disabled}
          />
        </FormField>
        <FormField label={t('endAt')} htmlFor="setup-end-at">
          <DateTimePicker
            id="setup-end-at"
            label={t('endAt')}
            value={endAt}
            onChange={setEndAt}
            disabled={disabled}
          />
        </FormField>
      </div>
      {startAt && endAt && !validRange && (
        <p className="mt-3 text-sm text-danger">{t('endAfterStart')}</p>
      )}
      <Button
        className="mt-4"
        size="sm"
        disabled={!validRange || disabled}
        onClick={() => onSubmit(startAt, endAt, timezone)}
      >
        <Send className="size-4" />
        {t('sendDates')}
      </Button>
    </div>
  );
}

function getGuidedSetupStep(completeness: EventCompleteness): GuidedSetupStep {
  const missing = new Set(completeness.missing);
  if (['name', 'description', 'category'].some((field) => missing.has(field))) return 'basics';
  if (
    ['startAt', 'endAt', 'timezone'].some((field) => missing.has(field)) ||
    completeness.warnings.some((warning) =>
      ['endBeforeStart', 'invalidTimezone'].includes(warning),
    )
  )
    return 'dates';
  if (missing.has('location')) return 'location';
  if (missing.has('organizerName') || missing.has('organizerEmail')) return 'organizer';
  return completeness.ready ? 'ready' : 'details';
}

function setupComposerPlaceholder(
  step: GuidedSetupStep,
  t: ReturnType<typeof useTranslation<'events'>>['t'],
): string {
  if (step === 'basics') return t('basicsChatPlaceholder');
  if (step === 'dates') return t('datesChatPlaceholder');
  if (step === 'location') return t('locationChatPlaceholder');
  if (step === 'organizer') return t('organizerChatPlaceholder');
  return t('addMoreEventInformation');
}

function EventDraftSummary({
  draft,
  completeness,
  facts,
  schedule,
  createError,
  createPending,
  canSubmit,
  onCreate,
}: {
  draft: Draft;
  completeness: EventCompleteness;
  facts: number;
  schedule: number;
  createError?: string;
  createPending: boolean;
  canSubmit: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation('events');
  return (
    <div aria-label={t('liveEventBrief')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-4" />
            {t('liveEventBrief')}
          </p>
          <h2 className="mt-2 font-display text-2xl">
            {draft.name || t('eventBriefBuilding')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`categories.${draft.category}`)}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
          {completeness.score}%
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryItem
          icon={MapPin}
          label={t('location')}
          value={[draft.venue, draft.destination].filter(Boolean).join(', ') || t('waitingForAnswer')}
        />
        <SummaryItem
          icon={CalendarDays}
          label={t('dateRange')}
          value={
            draft.startAt
              ? `${formatDraftDate(draft.startAt)}${draft.endAt ? ` – ${formatDraftDate(draft.endAt)}` : ''}`
              : t('waitingForAnswer')
          }
        />
        <SummaryItem
          icon={UserRound}
          label={t('organizer')}
          value={
            [draft.organizerName, draft.organizerEmail].filter(Boolean).join(' · ') ||
            t('waitingForAnswer')
          }
        />
      </div>
      {draft.description && (
        <div className="mt-3 rounded-xl bg-surface-sunken p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t('purpose')}
          </p>
          <p className="mt-2 text-sm leading-6">{draft.description}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-3 py-1.5">
          {t('dynamicDetailCount', { count: facts })}
        </span>
        <span className="rounded-full border border-border px-3 py-1.5">
          {t('scheduleItemCount', { count: schedule })}
        </span>
      </div>
      <div className="mt-5">
        <CompletenessPanel completeness={completeness} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {canSubmit ? t('chatReviewReady') : t('chatKeepAnswering')}
      </p>
      {createError && <p className="mt-4 text-sm text-danger">{createError}</p>}
      {canSubmit && (
        <Button className="mt-5 w-full sm:w-auto" size="lg" loading={createPending} onClick={onCreate}>
          {t('continue')}
        </Button>
      )}
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function EventBriefTemplateCard() {
  const { t } = useTranslation('events');
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t('eventBriefTemplate')}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('eventBriefTemplateDescription')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/15 bg-surface/60 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          feliam-event-brief-template.txt
        </span>
        <Button size="sm" onClick={downloadEventBriefTemplate}>
          <Download className="size-4" />
          {t('downloadTemplate')}
        </Button>
      </div>
    </div>
  );
}

function downloadEventBriefTemplate() {
  const content = `FELIAM EVENT BRIEF

Fill in what you know and leave anything else blank. Save this file, then attach it in the event setup chat.

EVENT BASICS
Event name:
Event type or purpose:
Description:
Destination or city:
Venue:
Venue address:
Start date and time:
End date and time:
Timezone, for example Europe/Madrid:
Organizer name:
Organizer email:

SCHEDULE
Add one activity per line using: Date | Start time | End time | Activity | Location


ADDITIONAL EVENT DETAILS
Add any details that matter for this event using: Title | Description
Examples: Dress code | Business casual
Examples: Shuttle pickup | Hotel lobby at 08:30
Examples: Accessibility | Step-free entrance is on the east side
Examples: Wi-Fi | Network and access instructions will be shared at check-in

`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'feliam-event-brief-template.txt';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDraftDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
