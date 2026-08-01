'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { conversationsApi, messagesApi } from '@/lib/api/messaging';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Conversation, Message } from '@/lib/types';
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  function loadMessages() {
    if (!user?.companyId) return;
    messagesApi
      .list(user.companyId, conversationId)
      .then((msgs) => setMessages(msgs.slice().reverse())) // API returns newest-first; render oldest-first
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الرسائل'));
  }

  useEffect(() => {
    if (!user?.companyId) return;
    conversationsApi
      .get(user.companyId, conversationId)
      .then(setConversation)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المحادثة'));
    loadMessages();
    messagesApi.markRead(user.companyId, conversationId).catch(() => {});

    // Simple polling fallback for real-time updates in this Part-2 delivery.
    // NOTE: the backend already exposes a full Socket.io gateway
    // (ChatGateway at /chat) for true real-time push — wiring the
    // socket.io-client connection into this screen is the next
    // increment; polling keeps this screen fully functional (not mock)
    // in the meantime without requiring that extra integration.
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSendText() {
    if (!user?.companyId || !text.trim()) return;
    setSending(true);
    try {
      await messagesApi.sendText(user.companyId, conversationId, text.trim());
      setText('');
      loadMessages();
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
          loadMessages();
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
        <h1 className="text-lg font-bold">{conversation ? otherMemberName() : <Loading />}</h1>
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
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {m.type === 'VOICE' && m.audioUrl ? (
                    <audio controls src={`${ORIGIN}${m.audioUrl}`} className="max-w-full" />
                  ) : (
                    <p>{m.originalText}</p>
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
          onChange={(e) => setText(e.target.value)}
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
