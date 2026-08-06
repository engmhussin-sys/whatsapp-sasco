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

export default function ChatV2Page() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeenAt, setOtherLastSeenAt] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherMemberIdRef = useRef<string | null>(null);

  const loadHistory = useCallback(() => {
    if (!user?.companyId) return;
    messagesApi
      .list(user.companyId, conversationId)
      .then((msgs) => setMessages(msgs.slice().reverse()))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الرسائل'));
  }, [user, conversationId]);

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
      await messagesApi.sendText(user!.companyId!, conversationId, toSend, replyTarget?.id);
      setText('');
      setReplyTarget(null);
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
    <div className="flex h-[calc(100vh-110px)] flex-col rounded-dsCard border border-ds-cardBorder bg-ds-surface">
      {/* رأس المحادثة */}
      <div className="flex items-center justify-between border-b border-ds-cardBorder px-5 py-3.5">
        <div>
          <h1 className="text-[15px] font-semibold text-ds-text">{conversation ? otherMemberName() : <Loading />}</h1>
          {conversation && (
            <p className={`mt-0.5 text-xs ${otherOnline ? 'font-medium text-ds-successText' : 'text-ds-textMuted'}`}>
              {otherOnline ? '● متصل الآن' : otherLastSeenAt ? formatLastSeen(otherLastSeenAt) : 'غير متصل'}
            </p>
          )}
          {peerTyping && <p className="mt-0.5 text-xs text-ds-primary">يكتب الآن...</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-ds-successText' : 'text-ds-textMuted'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-ds-success' : 'bg-ds-trackBg'}`} />
          {connected ? 'متصل' : 'غير متصل'}
        </span>
      </div>

      {error && (
        <div className="px-5 pt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* الرسائل */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && <p className="text-center text-sm text-ds-textMuted">لا رسائل بعد — ابدأ المحادثة</p>}
          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            const myLang = user?.preferredLanguage ?? 'ar';
            const translated = isTranslatedFor(m, myLang);
            const missing = translationMissingFor(m, myLang);
            return (
              <div key={m.id} className={`group flex items-start gap-1.5 ${mine ? 'justify-start' : 'justify-end'}`}>
                {mine && <ReplyButton onClick={() => setReplyTarget(m)} />}
                <div
                  className={`max-w-xs rounded-dsCard px-4 py-2.5 text-sm ${
                    mine ? 'bg-gradient-to-br from-ds-primary to-ds-primaryDark text-white' : 'bg-ds-surfaceLight text-ds-text'
                  }`}
                >
                  {m.replyTo && (
                    <div
                      className={`mb-1.5 rounded-dsCardInner border-e-2 px-2 py-1 text-xs ${
                        mine ? 'border-white/40 bg-white/10 text-white/90' : 'border-ds-primary bg-ds-primaryLight text-ds-textSecondary'
                      }`}
                    >
                      <p className="font-semibold">{m.replyTo.sender.firstName} {m.replyTo.sender.lastName}</p>
                      <p className="truncate">{m.replyTo.originalText ?? 'رسالة'}</p>
                    </div>
                  )}
                  {m.type === 'VOICE' && m.audioUrl ? (
                    <audio controls src={`${ORIGIN}${m.audioUrl}`} className="max-w-full" />
                  ) : (
                    <>
                      <p className={translated ? 'font-semibold' : undefined}>{displayText(m, myLang)}</p>
                      {translated && (
                        <div className={`mt-1.5 border-t border-dashed pt-1.5 ${mine ? 'border-white/30' : 'border-ds-cardBorder'}`}>
                          <p className={`text-[10px] ${mine ? 'text-white/70' : 'text-ds-textMuted'}`}>النص الأصلي ({m.originalLang})</p>
                          <p className={`text-xs ${mine ? 'text-white/90' : 'text-ds-textSecondary'}`}>{m.originalText}</p>
                        </div>
                      )}
                      {missing && (
                        <span className="mt-1 inline-block rounded-dsPill bg-ds-warningBg px-2 py-0.5 text-[10px] font-medium text-ds-warningText">
                          تعذّرت الترجمة — هذا هو النص الأصلي
                        </span>
                      )}
                    </>
                  )}
                  <p className={`num mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-ds-textMuted'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    {mine && ` · ${statusLabel(m.status)}`}
                  </p>
                </div>
                {!mine && <ReplyButton onClick={() => setReplyTarget(m)} />}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {replyTarget && (
        <div className="flex items-center justify-between border-t border-ds-cardBorder bg-ds-primaryLight px-4 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-ds-primaryDarker">
              الرد على {replyTarget.sender?.firstName ?? ''} {replyTarget.sender?.lastName ?? ''}
            </p>
            <p className="truncate text-ds-textSecondary">{replyTarget.originalText ?? 'رسالة'}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="shrink-0 px-2 text-ds-textMuted hover:text-ds-text" title="إلغاء الرد" aria-label="إلغاء الرد">
            <CloseIcon />
          </button>
        </div>
      )}

      {/* شريط الإدخال */}
      <div className="flex items-center gap-2 border-t border-ds-cardBorder p-3.5">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition ${
            recording ? 'bg-ds-danger' : 'bg-ds-textMuted hover:bg-ds-textSecondary'
          }`}
          title="رسالة صوتية"
          aria-label="تسجيل رسالة صوتية"
        >
          {recording ? <StopIcon /> : <MicIcon />}
        </button>
        <input
          placeholder="اكتب رسالة..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          className="flex-1 rounded-dsField border border-ds-fieldBorder px-3 py-2 text-sm focus:border-ds-primary focus:outline-none"
        />
        <button
          onClick={handleSendText}
          disabled={sending || !text.trim()}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
        >
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

function ReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-2 shrink-0 text-ds-textMuted opacity-0 transition-opacity hover:text-ds-primary group-hover:opacity-100" title="الرد على هذه الرسالة" aria-label="الرد على هذه الرسالة">
      <ReplyIcon />
    </button>
  );
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 17l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h10a6 6 0 0 1 6 6v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" strokeLinecap="round" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
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
