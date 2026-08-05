'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { assetsApi, Asset } from '@/lib/api/assets';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'نشط', IN_MAINTENANCE: 'قيد الصيانة', RETIRED: 'خارج الخدمة' };
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-ds-successBg text-ds-successText',
  IN_MAINTENANCE: 'bg-ds-warningBg text-ds-warningText',
  RETIRED: 'bg-ds-trackBg text-ds-textMuted',
};

export default function AssetsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  function load() {
    if (!companyId) return;
    assetsApi.list(companyId).then(setAssets).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الأصول'));
  }

  useEffect(load, [companyId]);

  async function handleCreate() {
    try {
      await assetsApi.create(companyId, { name, category: category || undefined });
      setName('');
      setCategory('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إضافة الأصل');
    }
  }

  if (error && !assets) return <ErrorBanner message={error} />;
  if (!assets) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إدارة الأصول</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          + أصل جديد
        </button>
      </div>
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <div className="flex items-end gap-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">الاسم</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">الفئة</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            />
          </div>
          <button onClick={handleCreate} disabled={!name} className="rounded-dsField bg-ds-text px-4 py-1.5 text-sm text-white disabled:opacity-50">
            حفظ
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
        >
          <span>الأصل</span>
          <span>الفئة</span>
          <span>المُكلَّف</span>
          <span>الحالة</span>
        </div>
        {assets.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد أصول مُسجَّلة بعد</p>
        ) : (
          assets.map((a) => (
            <div
              key={a.id}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
            >
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-ds-textSecondary">{a.category ?? '—'}</span>
              <span className="text-xs text-ds-textSecondary">
                {a.assignedToUser ? `${a.assignedToUser.firstName} ${a.assignedToUser.lastName}` : '—'}
              </span>
              <span className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
