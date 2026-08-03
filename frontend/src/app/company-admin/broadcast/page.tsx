'use client';

import { useEffect, useState } from 'react';
import { broadcastApi } from '@/lib/api/broadcast';
import { languagesApi, type CompanyLanguage } from '@/lib/api/languages';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function BroadcastPage() {
  const { user } = useAuth();
  const [languages, setLanguages] = useState<CompanyLanguage[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(true);
  const [text, setText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    languagesApi
      .listCompanyLanguages(user.companyId)
      .then((langs) => {
        setLanguages(langs);
        // Default to the admin's own preferred language if it's among the company's supported set, otherwise the first supported one.
        const preferred = langs.find((l) => l.langCode === user.preferredLanguage);
        setSourceLanguage(preferred?.langCode ?? langs[0]?.langCode ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب اللغات المدعومة'))
      .finally(() => setLoadingLanguages(false));
  }, [user]);

  async function handleSend() {
    if (!user?.companyId || !text.trim() || !sourceLanguage) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await broadcastApi.send(user.companyId, text.trim(), sourceLanguage, urgent);
      setResult({ recipientCount: res.recipientCount });
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال البث');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-bold">إرسال رسالة لكل الفريق</h1>
      <p className="mb-5 text-sm text-slate-500">
        تصل الرسالة تلقائيًا إلى كل عضو نشط في الشركة، مُترجَمة إلى لغته المفضّلة الخاصة به.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          أُرسلت الرسالة بنجاح إلى {result.recipientCount.toLocaleString('ar')} عضوًا — سيراها كل شخص بلغته المفضّلة تلقائيًا.
        </div>
      )}

      <div className="card space-y-4">
        {/* ---- Supported languages, shown explicitly as requested ---- */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">اللغات المدعومة في النظام</label>
          {loadingLanguages ? (
            <Loading />
          ) : languages.length === 0 ? (
            <p className="text-sm text-slate-400">لم تُفعّل أي لغة لهذه الشركة بعد — راجع إعدادات اللغات أولًا.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {languages.map((cl) => (
                <span key={cl.langCode} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                  {cl.language.nativeName} ({cl.langCode}){cl.language.isRtl && ' · RTL'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---- Source language picker ---- */}
        <div>
          <label htmlFor="sourceLanguage" className="mb-1.5 block text-sm font-medium text-slate-700">
            اللغة التي تكتب بها هذه الرسالة
          </label>
          <select
            id="sourceLanguage"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            className="input"
            disabled={languages.length === 0}
          >
            {languages.map((cl) => (
              <option key={cl.langCode} value={cl.langCode}>
                {cl.language.nativeName} ({cl.langCode})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            سيُترجَم النص تلقائيًا من هذه اللغة إلى لغة كل مستلم — اختر اللغة التي تكتب بها فعليًا، وليس بالضرورة لغتك الافتراضية.
          </p>
        </div>

        {/* ---- Message text ---- */}
        <div>
          <label htmlFor="broadcastText" className="mb-1.5 block text-sm font-medium text-slate-700">
            نص الرسالة
          </label>
          <textarea
            id="broadcastText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={4000}
            className="input resize-none"
            placeholder="اكتب رسالتك هنا..."
          />
          <p className="mt-1 text-left text-xs text-slate-400">{text.length} / 4000</p>
        </div>

        {/* ---- Urgent toggle ---- */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          إشعار طارئ (Emergency) — لأولوية أعلى مثل حالات الطوارئ الفعلية
        </label>

        <button
          onClick={handleSend}
          disabled={sending || !text.trim() || !sourceLanguage}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? 'جارٍ الإرسال...' : 'إرسال إلى كل الفريق'}
        </button>
      </div>
    </div>
  );
}
