import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, FileText, MessageSquarePlus, Paperclip, Send, X } from 'lucide-react';
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
    metadata?: { fileName?: string };
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
};

type SetupSubmission = {
  text: string;
  file: File | null;
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
  const [suggestedName, setSuggestedName] = useState('');
  const [nameDecision, setNameDecision] = useState<'accepted' | 'pending' | 'rejected'>('pending');
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
      const hasReviewedDetails =
        Object.values(restoredEvent).some(Boolean) ||
        (result.resumed && result.messages.some((message) => message.role === 'USER'));
      setReviewed(hasReviewedDetails);
      setSuggestedName(restored.suggestedName ?? '');
      setNameDecision(
        restored.nameWasProvided ? 'accepted' : restored.suggestedName ? 'pending' : 'pending',
      );
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
    mutationFn: ({ text, file: submittedFile }: SetupSubmission) =>
      apiClient.form<SetupAnalysis>(
        '/events/setup/analyze',
        {
          clientId,
          sessionId,
          ...(text ? { text } : {}),
        },
        submittedFile ?? undefined,
      ),
    onMutate: ({ text, file: submittedFile }) => {
      setConversation((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          ...(text ? { text } : {}),
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
      setSuggestedName(result.suggestedName);
      setNameDecision(result.nameWasProvided ? 'accepted' : 'pending');
      setAnalyzedContent({
        facts: result.facts ?? [],
        schedule: result.schedule ?? [],
        extractedFacts: result.extractedFacts,
        extractedScheduleItems: result.extractedScheduleItems,
      });
      setReviewed(true);
      setConversation((current) => [
        ...current,
        {
          id:
            result.messages?.find((message) => message.role === 'CONCIERGE')?.id ??
            crypto.randomUUID(),
          role: 'assistant',
          text: result.message?.trim() || t('reviewCompleteMessage'),
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
  const updateDraft = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
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
  const canSubmit =
    Boolean(clientId && sessionId) && draftCompleteness.ready && nameDecision === 'accepted';
  const composerDisabled = !setupReady || start.isPending || analyze.isPending || create.isPending;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const conversationEnd = conversationEndRef.current;
      if (conversationEnd && typeof conversationEnd.scrollIntoView === 'function')
        conversationEnd.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [analyze.isPending, conversation, nameDecision, reviewed, start.isPending]);
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
              <ChatBubble key={message.id}>{message.text}</ChatBubble>
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
          <div ref={conversationEndRef} className="h-px" aria-hidden />
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
                    ? t('addMoreEventInformation')
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
        <CustomSelect
          id="setup-category"
          label={t('category')}
          value={draft.category}
          options={categories.map((category) => ({
            value: category,
            label: t(`categories.${category}`),
          }))}
          onChange={(value) => update('category', value)}
        />
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
