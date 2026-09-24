import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
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
import { Input, Textarea } from '../../components/atoms/Input';
import { FormField } from '../../components/molecules/FormField';
import {
  AssistantMessage as ChatBubble,
  TypingIndicator as TypingBubble,
  UserMessage as UserChatBubble,
} from '../../components/molecules/ChatMessage';
import { CustomSelect } from '../../components/molecules/CustomSelect';
import { EventDateRangeCard } from '../../components/organisms/EventDateRangeCard';
import { activeClientId, can } from '../../features/auth/permissions';
import { useCurrentUser } from '../../features/auth/use-current-user';
import { CompletenessPanel } from '../../features/events/CompletenessPanel';
import {
  downloadEventBriefTemplate,
  type EventBriefTemplateFormat,
} from '../../features/events/event-brief-templates';
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
  dateHints?: { startDate: string; endDate: string };
  suggestedName: string;
  nameSuggestions?: string[];
  nameWasProvided: boolean;
  nameSuggestionRejected?: boolean;
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
  guests: Array<{ fullName: string; email: string; company?: string; guestGroup?: string; notes?: string }>;
  documentReviewPending?: boolean;
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
  message?: string;
  messages?: Array<{
    id: string;
    role: 'USER' | 'CONCIERGE';
    content: string;
    metadata?: { fileName?: string; setupTemplate?: 'EVENT_BRIEF' };
  }>;
  draft?: {
    event: Partial<Draft>;
    dateHints?: { startDate: string; endDate: string };
    facts: SetupAnalysis['facts'];
    schedule: SetupAnalysis['schedule'];
    guests: SetupAnalysis['guests'];
    documentReviewPending?: boolean;
    suggestedName: string;
    nameSuggestions?: string[];
    nameWasProvided: boolean;
    nameSuggestionRejected?: boolean;
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
  startAt?: string;
  endAt?: string;
  timezone?: string;
  nameDecision?: 'accept' | 'reject';
  eventName?: string;
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
  const dateCardRef = useRef<HTMLDivElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const restoreComposerFocus = () => requestAnimationFrame(() => {
    if (dateCardRef.current || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    composerRef.current?.focus({ preventScroll: true });
  });
  const defaultClient = params.get('clientId') ?? (user ? activeClientId(user) : '') ?? '';
  const [selectedClientId, setSelectedClientId] = useState(defaultClient);
  const [confirmedClientId, setConfirmedClientId] = useState('');
  const [restartOnNextStart, setRestartOnNextStart] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [nameSuggestionRejected, setNameSuggestionRejected] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [correctionRequested, setCorrectionRequested] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [dateHints, setDateHints] = useState({ startDate: '', endDate: '' });
  const [documentReviewPending, setDocumentReviewPending] = useState(false);
  const [selectedClientMessage, setSelectedClientMessage] = useState('');
  const [conversation, setConversation] = useState<SetupConversationMessage[]>([]);
  const [analyzedContent, setAnalyzedContent] = useState<
    Pick<SetupAnalysis, 'facts' | 'schedule' | 'guests' | 'extractedFacts' | 'extractedScheduleItems'>
  >({ facts: [], schedule: [], guests: [], extractedFacts: 0, extractedScheduleItems: 0 });
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
    mutationFn: async ({ nextClientId, restart = false }: { nextClientId: string; restart?: boolean }) => {
      const result = await apiClient.post<SetupStart>('/events/setup/start', { clientId: nextClientId, restart });
      if (!result?.sessionId || !result.clientId) throw new Error(t('setupStartInvalidResponse'));
      return result;
    },
    onSuccess: (result) => {
      setConfirmedClientId(result.clientId);
      setSessionId(result.sessionId);
      setRestartOnNextStart(false);
      const messages = Array.isArray(result.messages) ? result.messages : [];
      setConversation(messages.length
        ? messages.map((message) => ({
          id: message.id,
          role: message.role === 'USER' ? 'user' : 'assistant',
          text: message.content,
          fileName: message.metadata?.fileName,
          template: message.metadata?.setupTemplate,
        }))
        : [{
            id: `welcome-${result.sessionId}`,
            role: 'assistant',
            text: result.message?.trim() || t('setupWelcomeFallback'),
          }]);
      const restored = result.draft;
      setNameSuggestions(restored?.nameSuggestions?.length ? restored.nameSuggestions : restored?.suggestedName ? [restored.suggestedName] : []);
      setNameSuggestionRejected(Boolean(restored?.nameSuggestionRejected));
      setNameInput('');
      setCorrectionRequested(false);
      const restoredEvent = restored?.event ?? {};
      setDraft({
        ...emptyDraft,
        ...Object.fromEntries(
          Object.entries(restoredEvent).filter(([, value]) => typeof value === 'string'),
        ),
        startAt: restoredEvent.startAt ?? '',
        endAt: restoredEvent.endAt ?? '',
      });
      const hasReviewedDetails = Object.values(restoredEvent).some(Boolean);
      setReviewed(hasReviewedDetails);
      setDocumentReviewPending(Boolean(restored?.documentReviewPending));
      setDateHints(restored?.dateHints ?? { startDate: '', endDate: '' });
      setAnalyzedContent({
        facts: restored?.facts ?? [],
        schedule: restored?.schedule ?? [],
        guests: restored?.guests ?? [],
        extractedFacts: restored?.facts?.length ?? 0,
        extractedScheduleItems: restored?.schedule?.length ?? 0,
      });
      setSource('');
      setFile(null);
      restoreComposerFocus();
    },
  });
  const analyze = useMutation({
    mutationFn: ({ text, file: submittedFile, startAt, endAt, timezone, nameDecision, eventName }: SetupSubmission) =>
      apiClient.form<SetupAnalysis>(
        '/events/setup/analyze',
        {
          clientId,
          sessionId,
          ...(text ? { text } : {}),
          ...(startAt ? { startAt } : {}),
          ...(endAt ? { endAt } : {}),
          ...(timezone ? { timezone } : {}),
          ...(nameDecision ? { nameDecision } : {}),
          ...(eventName ? { eventName } : {}),
        },
        submittedFile ?? undefined,
      ),
    onMutate: ({ text, file: submittedFile }) => {
      const optimisticId = crypto.randomUUID();
      setConversation((current) => [
        ...current,
        {
          id: optimisticId,
          role: 'user',
          ...(text ? { text } : {}),
          ...(submittedFile ? { fileName: submittedFile.name } : {}),
        },
      ]);
      setSource('');
      setFile(null);
      return { optimisticId };
    },
    onError: (_error, submission, context) => {
      setConversation((current) => current.filter((message) => message.id !== context?.optimisticId));
      setSource(submission.text);
      setFile(submission.file);
    },
    onSuccess: (result) => {
      setNameSuggestions(result.nameSuggestions?.length ? result.nameSuggestions : result.suggestedName ? [result.suggestedName] : []);
      setNameSuggestionRejected(Boolean(result.nameSuggestionRejected));
      if (result.event.name) setNameInput('');
      setDraft({
        ...emptyDraft,
        ...result.event,
        startAt: result.event.startAt ?? '',
        endAt: result.event.endAt ?? '',
      });
      setAnalyzedContent({
        facts: result.facts ?? [],
        schedule: result.schedule ?? [],
        guests: result.guests ?? [],
        extractedFacts: result.extractedFacts,
        extractedScheduleItems: result.extractedScheduleItems,
      });
      if (!result.template) setReviewed(true);
      setDocumentReviewPending(Boolean(result.documentReviewPending));
      if (result.dateHints) setDateHints(result.dateHints);
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
      if (Object.entries(result.event).some(([key, value]) => value !== draft[key as keyof Draft]))
        setCorrectionRequested(false);
    },
    onSettled: restoreComposerFocus,
  });
  const create = useMutation({
    mutationFn: async () => {
      const event = await apiClient.post<EventSummary>('/events', {
        clientId,
        setupSessionId: sessionId,
        ...Object.fromEntries(
          Object.entries(draft).filter(([, value]) => typeof value === 'string' && value.trim()),
        ),
        startAt: draft.startAt || undefined,
        endAt: draft.endAt || undefined,
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
    setNameSuggestions([]);
    setNameSuggestionRejected(false);
    setNameInput('');
    setCorrectionRequested(false);
    setReviewed(false);
    setDocumentReviewPending(false);
    setDateHints({ startDate: '', endDate: '' });
    setAnalyzedContent({
      facts: [],
      schedule: [],
      guests: [],
      extractedFacts: 0,
      extractedScheduleItems: 0,
    });
  };
  const saveClient = () => {
    const selectedClient = clients.data?.find((client) => client.id === selectedClientId);
    setSelectedClientMessage(selectedClient?.name ?? t('client'));
    start.mutate({ nextClientId: selectedClientId, restart: restartOnNextStart });
  };
  const startNewChat = () => {
    if (!isSuperAdmin) {
      start.mutate({ nextClientId: clientId, restart: true });
      return;
    }
    selectClient('');
    setRestartOnNextStart(true);
  };
  const submitBrief = () => {
    const text = source.trim();
    if (!setupReady || analyze.isPending || (!text && !file)) return;
    analyze.mutate({
      text,
      file,
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
  const canSubmit = Boolean(clientId && sessionId) && draftCompleteness.ready && !documentReviewPending;
  const guidedStep = getGuidedSetupStep(draftCompleteness);
  const composerDisabled = !setupReady || start.isPending || analyze.isPending || create.isPending;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const log = chatLogRef.current;
      const dateCard = dateCardRef.current;
      if (log && dateCard && typeof log.scrollTo === 'function') {
        log.scrollTo({
          top: log.scrollTop + dateCard.getBoundingClientRect().top - log.getBoundingClientRect().top - 16,
          behavior: 'smooth',
        });
        return;
      }
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
              onClick={startNewChat}
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
          {analyze.isPending && <TypingBubble label={t('reviewingEventInformation')} />}
          {analyze.error && <ChatBubble danger>{analyze.error.message}</ChatBubble>}
          {setupReady && reviewed && !draft.name && (nameSuggestions.length > 0 || nameSuggestionRejected) && !documentReviewPending && !analyze.isPending && (
            <ChatBubble>
              {nameSuggestionRejected ? (
                <form onSubmit={(event) => {
                  event.preventDefault();
                  if (nameInput.trim().length < 2 || composerDisabled) return;
                  analyze.mutate({ text: nameInput.trim(), file: null, eventName: nameInput.trim() });
                }}>
                  <FormField label={t('provideEventName')} htmlFor="setup-event-name">
                    <Input id="setup-event-name" value={nameInput} minLength={2} maxLength={160}
                      required disabled={composerDisabled} onChange={(event) => setNameInput(event.target.value)} />
                  </FormField>
                  <Button className="mt-3" type="submit" disabled={composerDisabled || nameInput.trim().length < 2}>
                    {t('useThisName')}
                  </Button>
                </form>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t('nameSuggestionsPrompt')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nameSuggestions.map((name) => (
                      <Button key={name} variant="secondary" disabled={composerDisabled} onClick={() => analyze.mutate({
                        text: `${t('useThisName')}: ${name}`, file: null, nameDecision: 'accept', eventName: name,
                      })}>{name}</Button>
                    ))}
                    <Button variant="secondary" disabled={composerDisabled} onClick={() => analyze.mutate({
                      text: t('otherName'), file: null, nameDecision: 'reject',
                    })}>{t('otherName')}</Button>
                  </div>
                </>
              )}
            </ChatBubble>
          )}
          {setupReady && reviewed && !documentReviewPending && guidedStep === 'dates' && !analyze.isPending && (
            <div ref={dateCardRef}>
              <ChatBubble wide>
                <EventDateRangeCard
                  key={[draft.startAt, draft.endAt, draft.timezone, dateHints.startDate, dateHints.endDate].join('|')}
                  value={{ startAt: draft.startAt, endAt: draft.endAt, timezone: draft.timezone,
                    startDate: dateHints.startDate, endDate: dateHints.endDate }}
                  disabled={composerDisabled}
                  onSubmit={({ startAt, endAt, timezone }) => analyze.mutate({
                    text: `The event starts at ${startAt} and ends at ${endAt} in ${timezone}.`,
                    file: null, startAt, endAt, timezone,
                  })}
                />
              </ChatBubble>
            </div>
          )}
          {documentReviewPending && !analyze.isPending && (
            <ChatBubble>
              <p className="text-sm leading-6">{t('confirmDocumentDetailsPrompt')}</p>
              <Button
                className="mt-3"
                type="button"
                onClick={() => analyze.mutate({ text: 'Confirm details', file: null })}
              >
                <Check className="size-4" />
                {t('confirmDocumentDetails')}
              </Button>
            </ChatBubble>
          )}
          {reviewed && canSubmit && (
            <ChatBubble wide>
              <EventDraftSummary
                draft={draft}
                completeness={draftCompleteness}
                facts={analyzedContent.extractedFacts}
                schedule={analyzedContent.extractedScheduleItems}
                guests={analyzedContent.guests.length}
                createError={create.error?.message}
                createPending={create.isPending}
                canSubmit={canSubmit}
                correctionRequested={correctionRequested}
                onRequestCorrection={() => {
                  setCorrectionRequested(true);
                  composerRef.current?.focus({ preventScroll: true });
                }}
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
                  : documentReviewPending
                    ? t('documentReviewPlaceholder')
                    : reviewed
                      ? correctionRequested ? t('correctionChatPlaceholder') : setupComposerPlaceholder(guidedStep, t)
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
  guests,
  createError,
  createPending,
  canSubmit,
  correctionRequested,
  onRequestCorrection,
  onCreate,
}: {
  draft: Draft;
  completeness: EventCompleteness;
  facts: number;
  schedule: number;
  guests: number;
  createError?: string;
  createPending: boolean;
  canSubmit: boolean;
  correctionRequested: boolean;
  onRequestCorrection: () => void;
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
          value={[draft.venue, draft.venueAddress, draft.destination].filter(Boolean).join(', ') || t('waitingForAnswer')}
        />
        <SummaryItem
          icon={CalendarDays}
          label={t('dateRange')}
          value={
            draft.startAt
              ? `${formatDraftDate(draft.startAt, draft.timezone)}${draft.endAt ? ` – ${formatDraftDate(draft.endAt, draft.timezone)}` : ''}`
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
        <span className="rounded-full border border-border px-3 py-1.5">
          {t('chatGuestCount', { count: guests })}
        </span>
      </div>
      <div className="mt-5">
        <CompletenessPanel completeness={completeness} />
      </div>
      <p className="mt-4 text-sm leading-6 font-semibold">{t('finalConfirmationPrompt')}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('finalConfirmationHelp')}</p>
      {createError && <p className="mt-4 text-sm text-danger">{createError}</p>}
      {canSubmit && (
        <div className="mt-5 flex flex-wrap gap-2">
          {!correctionRequested && <Button size="lg" loading={createPending} onClick={onCreate}>
            {t('continue')}
          </Button>}
          <Button size="lg" variant="secondary" disabled={createPending} onClick={onRequestCorrection}>
            {t('changeEventDetails')}
          </Button>
        </div>
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
  const [downloading, setDownloading] = useState<EventBriefTemplateFormat | null>(null);
  const [downloadError, setDownloadError] = useState(false);
  const download = async (format: EventBriefTemplateFormat) => {
    setDownloading(format);
    setDownloadError(false);
    try {
      await downloadEventBriefTemplate(format);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(null);
    }
  };
  const formats: Array<{
    format: EventBriefTemplateFormat;
    icon: typeof FileText;
    title: string;
    description: string;
    recommended?: boolean;
  }> = [
    {
      format: 'docx',
      icon: FileType2,
      title: t('wordTemplate'),
      description: t('wordTemplateDescription'),
      recommended: true,
    },
    {
      format: 'xlsx',
      icon: FileSpreadsheet,
      title: t('excelTemplate'),
      description: t('excelTemplateDescription'),
    },
    {
      format: 'txt',
      icon: FileText,
      title: t('textTemplate'),
      description: t('textTemplateDescription'),
    },
  ];
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
      <div className="grid gap-3 border-t border-primary/15 bg-surface/60 p-4 sm:grid-cols-3">
        {formats.map(({ format, icon: Icon, title, description, recommended }) => (
          <button
            key={format}
            type="button"
            className={`relative rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${recommended ? 'border-primary/45 bg-primary/5' : 'border-border bg-surface'}`}
            disabled={downloading !== null}
            aria-label={t('downloadTemplateFormat', { format: title })}
            onClick={() => void download(format)}
          >
            {recommended && (
              <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                {t('recommended')}
              </span>
            )}
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-primary">
              <Icon className="size-4.5" />
            </span>
            <span className="mt-3 block text-sm font-semibold">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              <Download className="size-3.5" />
              {downloading === format ? t('preparingDownload') : t('download')}
            </span>
          </button>
        ))}
      </div>
      {downloadError && <p className="px-4 pb-4 text-sm text-danger">{t('templateDownloadError')}</p>}
    </div>
  );
}

function formatDraftDate(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}
