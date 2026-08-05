'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { knowledgeBaseApi, KnowledgeArticle, KnowledgeArticleCategory } from '@/lib/api/knowledge-base';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const CATEGORY_LABELS: Record<KnowledgeArticleCategory, string> = {
  GETTING_STARTED: 'البدء السريع',
  MODULES: 'الوحدات',
  BILLING: 'الفوترة',
  TROUBLESHOOTING: 'حل المشكلات',
  OTHER: 'أخرى',
};

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [articles, setArticles] = useState<KnowledgeArticle[] | null>(null);
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  function load() {
    if (!companyId) return;
    knowledgeBaseApi
      .listForCompany(companyId, true)
      .then(setArticles)
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل قاعدة المعرفة'));
  }

  useEffect(load, [companyId]);

  async function handleCreate() {
    try {
      await knowledgeBaseApi.createCompanyArticle(companyId, { title, body, isPublished: true });
      setTitle('');
      setBody('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء المقالة');
    }
  }

  if (error && !articles) return <ErrorBanner message={error} />;
  if (!articles) return <Loading />;

  return (
    <div className="grid grid-cols-[1fr_1.6fr] gap-[14px]">
      <div className="flex flex-col gap-[14px]">
        <div className="flex items-center justify-between">
          <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">قاعدة المعرفة</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-3 py-1.5 text-xs font-medium text-white shadow-dsButton"
          >
            + مقالة
          </button>
        </div>
        {error && <ErrorBanner message={error} />}

        {showForm && (
          <div className="flex flex-col gap-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="المحتوى" rows={4} className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
            <button onClick={handleCreate} disabled={!title || !body} className="self-start rounded-dsField bg-ds-text px-3 py-1.5 text-xs text-white disabled:opacity-50">
              نشر
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {articles.length === 0 ? (
            <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-6 text-center text-sm text-ds-textSecondary">
              لا توجد مقالات بعد
            </div>
          ) : (
            articles.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className={`rounded-dsCard border p-3 text-right transition ${
                  selected?.id === a.id ? 'border-ds-primary bg-ds-primaryLight' : 'border-ds-cardBorder bg-ds-surface'
                }`}
              >
                <p className="text-sm font-medium text-ds-text">{a.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-dsPill bg-ds-trackBg px-2 py-0.5 text-[10px] text-ds-textMuted">
                    {CATEGORY_LABELS[a.category]}
                  </span>
                  {a.companyId === null && (
                    <span className="rounded-dsPill bg-ds-primaryLight px-2 py-0.5 text-[10px] text-ds-primaryDarker">عامة</span>
                  )}
                  {!a.isPublished && <span className="rounded-dsPill bg-ds-warningBg px-2 py-0.5 text-[10px] text-ds-warningText">مسودة</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-6">
        {selected ? (
          <div>
            <h2 className="text-xl font-semibold text-ds-text">{selected.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ds-textSecondary">{selected.body}</p>
          </div>
        ) : (
          <p className="text-sm text-ds-textMuted">اختر مقالة من القائمة لعرضها</p>
        )}
      </div>
    </div>
  );
}
