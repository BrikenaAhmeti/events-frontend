import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  MessageCircle,
  Paperclip,
  QrCode,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../atoms/Button';
import { Textarea } from '../atoms/Input';
import { apiClient } from '../../lib/api/api-client';
import { documentKeys, eventKeys } from '../../lib/api/query-keys';
import { useEventSocket } from '../../lib/websocket/use-event-socket';

type Message = { id: string; role: 'USER' | 'CONCIERGE'; content: string; failed?: boolean };
type ConciergeStreamEvent =
  | { type: 'status'; messageId: string; status: 'PROCESSING' }
  | { type: 'delta'; messageId: string; delta: string }
  | { type: 'message'; message: Message }
  | { type: 'error'; messageId: string; message: string };

export function ConciergeWorkspace({
  eventId,
  guest = false,
  allowPlanning = false,
  allowUpload = false,
  shareAccess,
}: {
  eventId: string;
  guest?: boolean;
  allowPlanning?: boolean;
  allowUpload?: boolean;
  shareAccess?: { url: string; qrSvg: string };
}) {
  const { t } = useTranslation('concierge');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'plan' | 'ask'>(guest || !allowPlanning ? 'ask' : 'plan');
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasStreamingText, setHasStreamingText] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamErrorShown = useRef(false);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ['concierge', eventId, guest ? 'guest' : 'organizer'],
    queryFn: ({ signal }) =>
      apiClient.get<{
        messages: Array<{ id: string; role: 'USER' | 'CONCIERGE'; content: string }>;
      }>(`${guest ? '/guest' : ''}/events/${eventId}/concierge/messages`, signal),
    retry: false,
  });
  useEffect(() => {
    if (history.data?.messages) setMessages(history.data.messages);
  }, [history.data]);
  const handleStreamEvent = useCallback((event: ConciergeStreamEvent) => {
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
    mutationFn: async ({
      content,
      selectedMode,
    }: {
      content: string;
      selectedMode: 'plan' | 'ask';
    }) => {
      if (selectedMode === 'plan')
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
    onSuccess: (result, variables) => {
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
      }
      if (
        variables.selectedMode === 'plan' &&
        'completeness' in result &&
        result.completeness?.ready
      )
        setMode('ask');
    },
    onError: () => {
      setHasStreamingText(false);
      if (streamErrorShown.current) return;
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'CONCIERGE', content: t('failed'), failed: true },
      ]);
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
  const submit = () => {
    const content = message.trim();
    if (!content || send.isPending) return;
    streamErrorShown.current = false;
    setHasStreamingText(false);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'USER', content }]);
    setMessage('');
    send.mutate({ content, selectedMode: mode });
  };
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      aria-labelledby="concierge-title"
    >
      <header className="border-b border-border bg-surface-sunken/45 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {t('eyebrow')}
            </p>
            <h2 id="concierge-title" className="mt-2 font-display text-3xl">
              {t('title')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {guest ? t('guestIntro') : t('organizerIntro')}
            </p>
          </div>
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
        {!guest && allowPlanning && (
          <div
            className="mt-5 inline-flex rounded-lg border border-border bg-surface p-1"
            role="group"
            aria-label={t('mode')}
          >
            <button
              type="button"
              className={`min-h-9 rounded-md px-3 text-sm font-semibold ${mode === 'plan' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('plan')}
            >
              {t('addDetails')}
            </button>
            <button
              type="button"
              className={`min-h-9 rounded-md px-3 text-sm font-semibold ${mode === 'ask' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('ask')}
            >
              {t('askQuestion')}
            </button>
          </div>
        )}
      </header>
      <div className="min-h-[22rem] space-y-5 p-4 sm:min-h-[28rem] sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="grid min-h-72 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <MessageCircle className="size-5" />
              </span>
              <p className="mt-4 font-display text-xl">
                {guest ? t('guestWelcome') : t('organizerWelcome')}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(guest
                  ? [
                      t('guestSuggestionToday'),
                      t('guestSuggestionMeet'),
                      t('guestSuggestionDinner'),
                    ]
                  : [t('organizerSuggestionPlan'), t('organizerSuggestionMissing')]
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMessage(suggestion)}
                    className="rounded-full border border-border bg-surface-raised px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((item) => (
          <article
            key={item.id}
            className={`flex ${item.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${item.role === 'USER' ? 'rounded-br-md bg-primary text-primary-foreground' : item.failed ? 'rounded-bl-md border border-danger/20 bg-danger/10 text-danger' : 'rounded-bl-md border border-border bg-surface-raised'}`}
            >
              {item.role === 'CONCIERGE' && item.content === t('updated') && (
                <CheckCircle2 className="mb-2 size-5 text-success" />
              )}
              {item.content}
            </div>
          </article>
        ))}
        {send.isPending && !hasStreamingText && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-bl-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
              {t('processing')}
            </div>
          </div>
        )}
        {shareAccess && (
          <article className="flex justify-start">
            <div className="w-full max-w-xl rounded-2xl rounded-bl-md border border-border bg-surface-raised p-4 sm:p-5">
              <div className="flex items-center gap-2 font-semibold">
                <QrCode className="size-5 text-primary" />
                {t('guestAccessReady')}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('guestAccessReadyDescription')}
              </p>
              <img
                className="mx-auto mt-4 size-48 rounded-xl border border-border bg-white p-2"
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(shareAccess.qrSvg)}`}
                alt={t('guestAccessQr')}
              />
              <p className="mt-4 break-all rounded-lg bg-surface-sunken p-3 text-xs">
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
          </article>
        )}
      </div>
      <div className="border-t border-border p-3 sm:p-4">
        <div className="rounded-xl border border-input bg-surface-raised p-2 focus-within:border-focus">
          <label htmlFor="concierge-message" className="sr-only">
            {t('placeholder')}
          </label>
          <Textarea
            id="concierge-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className="min-h-20 resize-none border-0 bg-transparent focus:outline-none"
            placeholder={t('placeholder')}
            maxLength={4_000}
          />
          <div className="flex items-center justify-between gap-2">
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
                />
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  loading={upload.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                  {t('attach')}
                </Button>
              </>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!message.trim() || send.isPending}
            >
              <ArrowUp className="size-4" />
              {t('send')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
