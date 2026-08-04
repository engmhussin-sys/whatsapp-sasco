'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { conversationsApi, messagesApi } from '@/lib/api/messaging';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { chatSocket } from '@/lib/websocket-client';
import type { Conversation, Message } from '@/lib/types';
import { displayText, isTranslatedFor, translationMissingFor } from '@/lib/message-display';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const ORIGIN = API_URL.replace(/\/api\/v1$/, '');

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  // BUG FIX (confirmed real gap): there was no live "other party is
  // online" signal anywhere — only a static lastSeenAt that updated on
  // DISCONNECT alone, and the dashboard didn't even type/read it. Now
  // seeded from the conversation fetch and kept live via
  // ChatGateway's new presence:changed broadcast (see chat.gateway.ts).
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeenAt, setOtherLastSeenAt] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Presence listener is registered once per [user, conversationId]
  // effect run, BEFORE the conversation fetch resolves — a plain
  // closure over `conversation` state would stay stale at whatever it
  // was (null) at setup time. A ref sidesteps that entirely.
  const otherMemberIdRef = useRef<string | null>(null);

  const loadHistory = useCallback(() => {
    if (!user?.companyId) return;
    messagesApi
      .list(user.companyId, conversationId)
      .then((msgs) => setMessages(msgs.slice().reverse())) // API returns newest-first; render oldest-first
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الرسائل'));
  }, [user, conversationId]);

  // ---- Real-time WebSocket wiring (replaces the earlier polling fallback) ----
  useEffect(() => {
    if (!user?.companyId) return;

    conversationsApi
      .get(user.companyId, conversationId)
      .then((conv) => {
        setConversation(conv);
        const other = conv.members.find((m) => m.userId !== user.id);
        otherMemberIdRef.current = other?.userId ?? null;
        setOtherLastSeenAt(other?.user.lastSeenAt ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المحادثة'));

    loadHistory();
    messagesApi.markRead(user.companyId, conversationId).catch(() => {});

    const socket = chatSocket.connect();

    const onConnect = () => {
      setConnected(true);
      chatSocket.joinConversation(conversationId);
    };
    const onDisconnect = () => setConnected(false);
    const onNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      if (message.senderId !== user.id) {
        chatSocket.markRead(conversationId, message.id);
      }
    };
    // BUG FIX (confirmed real cause of "messages sent don't translate"):
    // the dashboard used to have no way to learn that a translation
    // completed AFTER the message already rendered — which, given
    // translation runs in the background and near-real-time delivery
    // usually beats it there, meant every message effectively stayed
    // permanently untranslated until a full page reload. Mirrors the
    // same fix already shipped to the mobile app's ChatBloc.
    const onMessageTranslated = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    };
    const onTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== user.id) setPeerTyping(data.isTyping);
    };
    const onPresenceChanged = (data: { userId: string; isOnline: boolean; lastSeenAt: string | null }) => {
      if (data.userId !== otherMemberIdRef.current) return;
      setOtherOnline(data.isOnline);
      setOtherLastSeenAt(data.lastSeenAt);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onNewMessage);
    socket.on('message:translated', onMessageTranslated);
    socket.on('typing', onTyping);
    socket.on('presence:changed', onPresenceChanged);
    if (socket.connected) onConnect();

    return () => {
      chatSocket.leaveConversation(conversationId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onNewMessage);
      socket.off('message:translated', onMessageTranslated);
      socket.off('typing', onTyping);
      socket.off('presence:changed', onPresenceChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleTextChange(value: string) {
    setText(value);
    chatSocket.sendTyping(conversationId, value.length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => chatSocket.sendTyping(conversationId, false), 2000);
  }

  async function handleSendText() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const toSend = text.trim();
    try {
      // BUG FIX (confirmed real gap): this used to fire-and-forget over
      // the socket (chatSocket.sendMessage), which has NO server
      // acknowledgment and NO error surfacing at all — a rejected send
      // (a chat policy rule, any backend validation failure) looked
      // completely identical to a successful one: input clears,
      // nothing else happens. Switched to the same REST endpoint
      // sendVoice already used successfully, which throws a real,
      // catchable error on failure. The message still appears via the
      // exact same socket message:new broadcast either way (see
      // onNewMessage above) — REST vs socket-originated sends both
      // trigger the identical server-side broadcast now.
      await messagesApi.sendText(user!.companyId!, conversationId, toSend);
      setText('');
      chatSocket.sendTyping(conversationId, false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordStartRef.current = Date.now();
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        if (!user?.companyId) return;
        const durationMs = Date.now() - recordStartRef.current;
        try {
          // Voice messages still go through REST (multipart upload isn't
          // practical over a socket event) — the backend then broadcasts
          // it over the socket to other members same as a text message.
          await messagesApi.sendVoice(user.companyId, conversationId, blob, durationMs);
          loadHistory();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الرسالة الصوتية');
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('تعذّر الوصول إلى الميكروفون — تحقق من صلاحيات المتصفح');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function otherMemberName() {
    if (!conversation) return '';
    const other = conversation.members.find((m) => m.userId !== user?.id);
    return other ? `${other.user.firstName} ${other.user.lastName}` : conversation.title ?? 'محادثة';
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="border-b border-slate-200 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{conversation ? otherMemberName() : <Loading />}</h1>
          <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-300'}`} />
            {connected ? 'متصل' : 'غير متصل'}
          </span>
        </div>
        {conversation && (
          <p className={`mt-0.5 text-xs ${otherOnline ? 'font-medium text-green-600' : 'text-slate-400'}`}>
            {otherOnline ? '● متصل الآن' : otherLastSeenAt ? formatLastSeen(otherLastSeenAt) : 'غير متصل'}
          </p>
        )}
        {peerTyping && <p className="mt-1 text-xs text-brand-600">يكتب الآن...</p>}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            const myLang = user?.preferredLanguage ?? 'ar';
            const translated = isTranslatedFor(m, myLang);
            const missing = translationMissingFor(m, myLang);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {m.type === 'VOICE' && m.audioUrl ? (
                    <audio controls src={`${ORIGIN}${m.audioUrl}`} className="max-w-full" />
                  ) : (
                    <>
                      <p className={translated ? 'font-semibold' : undefined}>{displayText(m, myLang)}</p>
                      {translated && (
                        <div className={`mt-1.5 border-t border-dashed pt-1.5 ${mine ? 'border-brand-300' : 'border-slate-300'}`}>
                          <p className={`text-[10px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                            النص الأصلي ({m.originalLang})
                          </p>
                          <p className={`text-xs ${mine ? 'text-brand-50' : 'text-slate-600'}`}>{m.originalText}</p>
                        </div>
                      )}
                      {missing && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          تعذّرت الترجمة — هذا هو النص الأصلي
                        </span>
                      )}
                    </>
                  )}
                  <p className={`mt-1 text-[10px] ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    {mine && ` · ${statusLabel(m.status)}`}
                  </p>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && <p className="text-center text-sm text-slate-400">لا رسائل بعد — ابدأ المحادثة</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`rounded-full p-2 text-white ${recording ? 'bg-red-600' : 'bg-slate-400 hover:bg-slate-500'}`}
          title="رسالة صوتية"
        >
          {recording ? '⏹' : '🎤'}
        </button>
        <input
          className="input"
          placeholder="اكتب رسالة..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
        />
        <button onClick={handleSendText} disabled={sending || !text.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          إرسال
        </button>
      </div>
    </div>
  );
}

function statusLabel(status: Message['status']) {
  if (status === 'READ') return 'قُرئت';
  if (status === 'DELIVERED') return 'وصلت';
  return 'أُرسلت';
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'آخر ظهور: الآن';
  if (minutes < 60) return `آخر ظهور: منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `آخر ظهور: منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `آخر ظهور: منذ ${days} يوم`;
}
