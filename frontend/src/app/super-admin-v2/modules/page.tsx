'use client';

import { useEffect, useState } from 'react';
import { modulesApi, ModuleCatalogEntry } from '@/lib/api/modules';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const CATEGORIES: { id: ModuleCatalogEntry['category'] | 'all'; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'communication', label: 'التواصل' },
  { id: 'operations', label: 'التشغيل' },
  { id: 'workforce', label: 'القوى العاملة' },
  { id: 'assets', label: 'الأصول والمخزون' },
  { id: 'compliance', label: 'الامتثال' },
  { id: 'insights', label: 'الذكاء والتحليلات' },
];

export default function ModulesMarketplacePage() {
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all');

  useEffect(() => {
    modulesApi.getCatalog().then(setCatalog).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الكتالوج'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!catalog) return <Loading />;

  const filtered = category === 'all' ? catalog : catalog.filter((m) => m.category === category);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">متجر الوحدات</h1>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-dsPill px-3.5 py-1.5 text-xs font-medium transition ${
              category === c.id ? 'bg-ds-primary text-white' : 'bg-ds-trackBg text-ds-textSecondary hover:bg-ds-primaryLight'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filtered.map((m) => (
          <div
            key={m.code}
            className={`flex flex-col rounded-dsCard border p-4 transition ${
              m.isComingSoon ? 'border-ds-cardBorder bg-ds-surfaceLight' : 'border-ds-cardBorder bg-ds-surface hover:border-ds-primaryLightBorder'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-dsCardInner bg-ds-primaryLight text-lg text-ds-primary">
                ◍
              </div>
              {m.isComingSoon && (
                <span className="rounded-dsPill bg-ds-trackBg px-2 py-0.5 text-[10px] text-ds-textMuted">قريبًا</span>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-ds-text">{m.nameAr}</p>
            <p className="mb-3 mt-1 min-h-[44px] text-xs text-ds-textSecondary">{m.descriptionAr}</p>
            <div className="mt-auto flex items-center justify-between border-t border-ds-rowDivider pt-2.5">
              <span className="text-[11px] text-ds-textMuted">{CATEGORIES.find((c) => c.id === m.category)?.label}</span>
              {!m.isComingSoon && (
                <span className="rounded-dsPill bg-ds-successBg px-2 py-0.5 text-[10px] text-ds-successText">جاهزة</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
