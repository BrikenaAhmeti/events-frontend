import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, CheckCircle2, Copy, Download, MessageSquarePlus, Paperclip, QrCode } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';
import { Textarea } from '../atoms/Input';
import { AssistantMessage, TypingIndicator, UserMessage } from '../molecules/ChatMessage';
import { GuestRowsCard } from './GuestRowsCard';
import { GuestImportDialog } from '../../features/guests/GuestImportDialog';
import { guestLanguageLabel, guestLanguageOptions } from '../../features/guest-chat/languages';
import { downloadGuestTemplate, type GuestImportPreview, type GuestImportRow } from '../../features/guests/guest-import';
import { apiClient } from '../../lib/api/api-client';
import { documentKeys, eventKeys, guestKeys, invitationKeys } from '../../lib/api/query-keys';
import { useEventSocket } from '../../lib/websocket/use-event-socket';
import { CustomSelect } from '../molecules/CustomSelect';

type Message = { id: string; role: 'USER' | 'CONCIERGE'; content: string; failed?: boolean };
type ConciergeStreamEvent =
  | { type: 'language'; language: string }
  | { type: 'status'; messageId: string; status: 'PROCESSING' }
  | { type: 'delta'; messageId: string; delta: string }
  | { type: 'message'; message: Message }
  | { type: 'error'; messageId: string; message: string };

const isQuestion = (content: string) =>
  (/\?\s*$/.test(content) || /^(what|when|where|who|how|why|is|are|can|could|do|does|tell me|show me)\b/i.test(content)) &&
  !/\b(add|update|change|set|remove|invite|register|save|correct|replace)\b/i.test(content);

export function ConciergeWorkspace({
  eventId,
  guest = false,
  allowPlanning = false,
  allowGuestManage = false,
  allowGuestImport = false,
  allowPublish = false,
  allowUpload = false,
  eventStatus,
  ready = false,
  guestCount = 0,
  shareAccess,
}: {
  eventId: string;
  guest?: boolean;
  allowPlanning?: boolean;
  allowGuestManage?: boolean;
  allowGuestImport?: boolean;
  allowPublish?: boolean;
  allowUpload?: boolean;
  eventStatus?: 'DRAFT' | 'READY' | 'PUBLISHED' | 'CANCELLED' | 'ARCHIVED';
  ready?: boolean;
  guestCount?: number;
  shareAccess?: { url: string; qrSvg: string };
}) {
  const { t } = useTranslation('concierge');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'details' | 'guests' | 'publish'>('details');
  const [guestRowsPending, setGuestRowsPending] = useState(false);
  const [guestPreview, setGuestPreview] = useState<GuestImportPreview | null>(null);
  const [publishWithInvitations, setPublishWithInvitations] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guestLanguage, setGuestLanguage] = useState<string | null>(null);
  const [hasStreamingText, setHasStreamingText] = useState(false);
  const sharingAccess = Boolean(shareAccess && messages.length === 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const guestFileRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const streamErrorShown = useRef(false);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ['concierge', eventId, guest ? 'guest' : 'organizer'],
    queryFn: ({ signal }) =>
      apiClient.get<{
        id: string | null;
        language?: string | null;
        messages: Array<{ id: string; role: 'USER' | 'CONCIERGE'; content: string }>;
      }>(`${guest ? '/guest' : ''}/events/${eventId}/concierge/messages`, signal),
    retry: false,
  });
  useEffect(() => {
    if (history.data?.messages) {
      setMessages(history.data.messages);
      if (guest) setGuestLanguage(history.data.language ?? null);
    }
  }, [guest, history.data]);
  const startGuestChat = useMutation({
    mutationFn: (language: string) => apiClient.post<{ id: string; language: string; messages: Message[] }>(
      `/guest/events/${eventId}/concierge/chats`, { language },
    ),
    onSuccess: (chat) => {
      setGuestLanguage(chat.language);
      setMessages([]);
      setMessage('');
      queryClient.setQueryData(['concierge', eventId, 'guest'], chat);
    },
  });
  const handleStreamEvent = useCallback((event: ConciergeStreamEvent) => {
    if (event.type === 'language') {
      setGuestLanguage(event.language);
      return;
    }
    if (event.type === 'status') {
      setHasStreamingText(false);
      return;
    }
    if (event.type === 'delta') {
      setHasStreamingText(true);
      setMessages((current) => {
        const existing = current.find(({ id }) => id === event.messageId);
        if (!existing) {
          return [...current, { id: event.messageId, role: 'CONCIERGE', content: event.delta }];
        }
        return current.map((item) =>
          item.id === event.messageId
            ? { ...item, content: `${item.content}${event.delta}` }
            : item,
        );
      });
      return;
    }
    if (event.type === 'message') {
      setHasStreamingText(false);
      setMessages((current) =>
        current.some(({ id }) => id === event.message.id)
          ? current.map((item) => (item.id === event.message.id ? event.message : item))
          : [...current, event.message],
      );
      return;
    }
    streamErrorShown.current = true;
    setHasStreamingText(false);
    setMessages((current) =>
      current.some(({ id }) => id === event.messageId)
        ? current.map((item) =>
            item.id === event.messageId ? { ...item, content: event.message, failed: true } : item,
          )
        : [
            ...current,
            { id: event.messageId, role: 'CONCIERGE', content: event.message, failed: true },
          ],
    );
  }, []);
  const socketEvent = useCallback(
    (type: string) => {
      if (type === 'document:progress') {
        void queryClient.invalidateQueries({ queryKey: documentKeys.list(eventId) });
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      }
      if (type === 'event:updated') {
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      }
    },
    [eventId, queryClient],
  );
  const socket = useEventSocket(eventId, socketEvent, !guest);
  const send = useMutation({
    mutationFn: async (content: string) => {
      if (!guest && allowPlanning && !isQuestion(content))
        return apiClient.post<{
          applied: boolean;
          message?: { id: string; content: string };
          completeness?: { ready: boolean; missing: string[] };
        }>(`/events/${eventId}/concierge/extract`, { text: content });
      await apiClient.stream<ConciergeStreamEvent>(
        `${guest ? '/guest' : ''}/events/${eventId}/concierge/stream`,
        { message: content },
        handleStreamEvent,
      );
      return { streamed: true as const };
    },
    onSuccess: (result) => {
      if ('applied' in result) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'CONCIERGE',
            content: result.message?.content ?? (result.applied ? t('updated') : t('reviewed')),
          },
        ]);
        void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
        void queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) });
      }
    },
    onError: (error, content) => {
      setHasStreamingText(false);
      if (guest) void queryClient.invalidateQueries({ queryKey: ['guest-event', eventId] });
      if (streamErrorShown.current) return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'CONCIERGE',
          content: !guest && allowPlanning && !isQuestion(content) ? error.message || t('failed') : t('failed'),
          failed: true,
        },
      ]);
    },
  });
  const previewGuests = useMutation({
    mutationFn: (file: File) => apiClient.upload<GuestImportPreview>(`/events/${eventId}/guests/imports/preview`, file),
    onSuccess: setGuestPreview,
  });
  const importGuests = useMutation({
    mutationFn: ({ rows }: { rows: GuestImportRow[]; sendOnPublish: boolean }) => apiClient.post<{ accepted: number }>(`/events/${eventId}/guests/imports/confirm`, { rows }),
    onSuccess: (result, options) => {
      setGuestPreview(null);
      setPublishWithInvitations(options.sendOnPublish);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'CONCIERGE', content: t('guestsImportedInChat', { count: result.accepted }) }]);
      void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) });
    },
  });
  const publish = useMutation({
    mutationFn: (sendInvitations: boolean) => apiClient.post<{ invitationsQueued: number }>(`/events/${eventId}/publish`, { sendInvitations }),
    onSuccess: (result) => {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: 'CONCIERGE', content: t('publishedInChat', { count: result.invitationsQueued ?? 0 }),
      }]);
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: invitationKeys.access(eventId) });
      void queryClient.invalidateQueries({ queryKey: invitationKeys.list(eventId) });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => apiClient.upload(`/events/${eventId}/documents`, file),
    onSuccess: () => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'CONCIERGE',
          content: t('documentUploaded'),
        },
      ]);
      void queryClient.invalidateQueries({ queryKey: documentKeys.list(eventId) });
    },
  });
  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (chatLog) {
      chatLog.scrollTop = sharingAccess ? 0 : chatLog.scrollHeight;
    }
  }, [messages, send.isPending, sharingAccess, startGuestChat.isPending, step, upload.isPending]);
  const submit = () => {
    const content = message.trim();
    if (!content || send.isPending || publish.isPending || startGuestChat.isPending || (guest && !guestLanguage)) return;
    streamErrorShown.current = false;
    setHasStreamingText(false);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'USER', content }]);
    setMessage('');
    send.mutate(content);
  };
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ${sharingAccess ? 'min-h-[clamp(36rem,72dvh,52rem)] lg:h-[clamp(36rem,72dvh,52rem)]' : 'h-[clamp(36rem,72dvh,52rem)]'}`}
      aria-labelledby="concierge-title"
    >
      <header className="border-b border-border bg-surface-sunken/45 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="concierge-title" className="font-display text-lg font-semibold">
            {t('title')}
          </h2>
          {guest && guestLanguage && <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{guestLanguageLabel(guestLanguage)}</span>
            <Button type="button" size="sm" variant="secondary" loading={startGuestChat.isPending} disabled={send.isPending || startGuestChat.isPending} onClick={() => startGuestChat.mutate(guestLanguage)}>
              <MessageSquarePlus className="size-4" />
              {t('newGuestChat')}
            </Button>
          </div>}
          {!guest && socket.enabled && (
            <span
              className={`inline-flex items-center gap-2 text-xs font-semibold ${socket.connected ? 'text-success' : 'text-muted-foreground'}`}
            >
              <span
                className={`size-2 rounded-full ${socket.connected ? 'bg-success' : 'bg-muted-foreground'}`}
              />
              {socket.connected ? t('live') : t('reconnecting')}
            </span>
          )}
        </div>
        {guest && guestLanguage && startGuestChat.error && (
          <p role="alert" className="mt-2 text-xs text-danger">{startGuestChat.error.message}</p>
        )}
      </header>
      <div
        ref={chatLogRef}
        className={`flex-1 space-y-5 bg-surface-sunken/20 p-4 sm:p-6 ${sharingAccess ? 'overflow-visible lg:overflow-y-auto' : 'overflow-y-auto'}`}
        role="log"
        aria-live="polite"
        aria-label={t('conversation')}
        aria-busy={history.isLoading || send.isPending || upload.isPending || startGuestChat.isPending}
      >
        {history.isLoading && <TypingIndicator label={t('loadingConversation')} />}
        {!history.isLoading && guest && !guestLanguage && (
          <AssistantMessage wide>
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('chooseGuestLanguage')}</p>
              <CustomSelect
                value=""
                label={t('guestLanguageLabel')}
                options={[{ value: '', label: t('selectGuestLanguage') }, ...guestLanguageOptions]}
                onChange={(language) => { if (language) startGuestChat.mutate(language); }}
                searchable
                searchPlaceholder={t('searchGuestLanguage')}
                disabled={startGuestChat.isPending}
                className="max-w-sm"
              />
              {startGuestChat.error && <p role="alert" className="text-sm text-danger">{startGuestChat.error.message}</p>}
            </div>
          </AssistantMessage>
        )}
        {!history.isLoading && messages.length === 0 && !sharingAccess && !guest && (
          <>
            <AssistantMessage>
              <p className="text-sm leading-6">
                {t('organizerWelcome')}
              </p>
            </AssistantMessage>
            <div className="ml-10 flex flex-wrap gap-2">
              {[t('organizerSuggestionPlan'), t('organizerSuggestionMissing')].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setMessage(suggestion);
                    messageRef.current?.focus();
                  }}
                  className="rounded-full border border-border bg-surface-raised px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}
        {(!guest || guestLanguage) && messages.map((item, index) =>
          item.role === 'USER' ? (
            <UserMessage key={item.id}>
              <p className="whitespace-pre-wrap">{item.content}</p>
            </UserMessage>
          ) : (
            <AssistantMessage key={item.id} danger={item.failed}>
              <div className="text-sm leading-6">
                {item.content === t('updated') && (
                  <CheckCircle2 className="mb-2 size-5 text-success" />
                )}
                <span className="whitespace-pre-wrap">{item.content}</span>
                {send.isPending &&
                  hasStreamingText &&
                  index === messages.length - 1 && (
                    <span
                      className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle motion-reduce:animate-none"
                      aria-hidden
                    />
                  )}
              </div>
            </AssistantMessage>
          ),
        )}
        {startGuestChat.isPending && <TypingIndicator label={t('startingGuestChat')} />}
        {send.isPending && !hasStreamingText && <TypingIndicator label={t('processing')} />}
        {upload.isPending && <TypingIndicator label={t('uploading')} />}
        {!guest && eventStatus === 'READY' && ready && allowPlanning && !history.isLoading && !publish.isSuccess && (
          <AssistantMessage wide>
            <div className="space-y-3 text-sm leading-6">
              {step === 'details' && (
                <>
                  <p>{t('detailsReadyContinue')}</p>
                  <Button type="button" onClick={() => setStep('guests')}>
                    {t('continue')}
                  </Button>
                </>
              )}
              {step === 'guests' && (
                <>
                  <p>{allowGuestManage || allowGuestImport ? t('guestChatPrompt') : t('guestPermissionPrompt')}</p>
                  <p className="font-semibold">{t('guestCount', { count: guestCount })}</p>
                  {allowGuestManage && <GuestRowsCard eventId={eventId} onPendingChange={setGuestRowsPending} onSaved={() => {
                    void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
                    void queryClient.invalidateQueries({ queryKey: guestKeys.list(eventId) });
                  }} />}
                  {allowGuestImport && <div className="flex flex-wrap gap-2">
                    <input ref={guestFileRef} type="file" accept=".csv,.xlsx" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) previewGuests.mutate(file); event.target.value = ''; }} />
                    <Button type="button" variant="secondary" loading={previewGuests.isPending} onClick={() => guestFileRef.current?.click()}>{t('uploadGuestList')}</Button>
                    <Button type="button" variant="quiet" onClick={() => void downloadGuestTemplate('csv')}>{t('csvGuestTemplate')}</Button>
                    <Button type="button" variant="quiet" onClick={() => void downloadGuestTemplate('xlsx')}>{t('excelGuestTemplate')}</Button>
                  </div>}
                  {previewGuests.error && <p role="alert" className="text-danger">{previewGuests.error.message}</p>}
                  {guestRowsPending && <p className="text-xs text-muted-foreground">{t('saveGuestBeforePublish')}</p>}
                  <Button type="button" disabled={guestRowsPending} onClick={() => setStep('publish')}>
                    {t('continueToPublish')}
                  </Button>
                </>
              )}
              {step === 'publish' && (
                <>
                  <p>{t('publishChatPrompt', { count: guestCount })}</p>
                  {publish.error && <p role="alert" className="text-danger">{publish.error.message}</p>}
                  {allowPublish ? <>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant={publishWithInvitations ? 'primary' : 'secondary'} onClick={() => setPublishWithInvitations(true)}>{t('publishAndSend')}</Button>
                      <Button type="button" variant={!publishWithInvitations ? 'primary' : 'secondary'} onClick={() => setPublishWithInvitations(false)}>{t('publishWithoutSending')}</Button>
                    </div>
                    <Button type="button" loading={publish.isPending} onClick={() => publish.mutate(publishWithInvitations)}>{t('publishEvent')}</Button>
                  </> : <p>{t('publishPermissionPrompt')}</p>}
                </>
              )}
            </div>
          </AssistantMessage>
        )}
        {guestPreview && <GuestImportDialog preview={guestPreview} close={() => setGuestPreview(null)} confirm={(rows, sendOnPublish) => importGuests.mutate({ rows, sendOnPublish })} loading={importGuests.isPending} canSendNow={false} canSendOnPublish sendDisabledReason={t('guestInvitationsOnPublish')} error={importGuests.error?.message} />}
        {shareAccess && (
          <AssistantMessage wide>
            <div className="w-full">
              <div className="flex items-center gap-2 font-semibold">
                <QrCode className="size-5 text-primary" />
                {t('guestAccessReady')}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('guestAccessReadyDescription')}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                <img
                  className="size-40 rounded-xl border border-border bg-white p-2"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(shareAccess.qrSvg)}`}
                  alt={t('guestAccessQr')}
                />
                <div className="min-w-0">
                  <p className="break-all rounded-lg bg-surface-sunken p-3 text-xs">
                    {shareAccess.url}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void navigator.clipboard.writeText(shareAccess.url)}
                    >
                      <Copy className="size-4" />
                      {t('copyGuestLink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(
                          new Blob([shareAccess.qrSvg], { type: 'image/svg+xml' }),
                        );
                        link.download = 'event-guest-qr.svg';
                        link.click();
                        URL.revokeObjectURL(link.href);
                      }}
                    >
                      <Download className="size-4" />
                      {t('downloadGuestQr')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </AssistantMessage>
        )}
      </div>
      {(!guest || guestLanguage) && <form
        className="border-t border-border bg-surface p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div
          className={`rounded-2xl border bg-background p-2 shadow-sm transition ${send.isPending ? 'border-border opacity-65' : 'border-input focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/15'}`}
        >
          <label htmlFor="concierge-message" className="sr-only">
            {t('placeholder')}
          </label>
          <Textarea
            ref={messageRef}
            id="concierge-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="max-h-28 !min-h-11 !resize-none border-0 bg-transparent px-2 py-2 focus:border-transparent"
            rows={1}
            placeholder={t('placeholder')}
            maxLength={4_000}
            disabled={send.isPending || publish.isPending || startGuestChat.isPending}
          />
          <div className="flex items-center gap-2 border-t border-border/70 px-1 pt-2">
            {!guest && allowUpload ? (
              <>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.docx,.txt,.csv,.xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload.mutate(file);
                    event.target.value = '';
                  }}
                  disabled={upload.isPending || send.isPending}
                />
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending || send.isPending}
                  aria-label={t('attach')}
                  title={t('attach')}
                >
                  <Paperclip className="size-5" />
                </button>
              </>
            ) : (
              <span className="size-10" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {t('sendHint')}
            </span>
            <Button
              type="submit"
              size="sm"
              className="size-10 min-h-10 shrink-0 rounded-full px-0"
              disabled={!message.trim() || send.isPending || publish.isPending || startGuestChat.isPending}
              aria-label={t('send')}
              title={t('send')}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">{t('send')}</span>
            </Button>
          </div>
        </div>
      </form>}
    </section>
  );
}
