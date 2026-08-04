'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companiesApi } from '@/lib/api/companies';
import type { Company } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const PLAN_LABELS: Record<string, string> = { TRIAL: 'تجريبية', BASIC: 'أساسية', PROFESSIONAL: 'نمو', ENTERPRISE: 'مؤسسية' };
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'نشط', PAST_DUE: 'متأخر السداد', CANCELED: 'مُلغى', EXPIRED: 'منتهٍ' };

export default function CompaniesV2Page() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    companiesApi
      .listAll()
      .then((res) => setCompanies(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الشركات'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!companies) return <Loading />;

  const filtered = companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الشركات</h1>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن شركة..."
          className="w-[280px] rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm text-ds-text placeholder:text-ds-textDisabled focus:border-ds-primary focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.1fr 110px' }}
        >
          <span>الشركة</span>
          <span>الخطة</span>
          <span>المقاعد</span>
          <span>القطاع</span>
          <span>الإنشاء</span>
          <span>الحالة</span>
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد شركات مطابقة</p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => router.push(`/super-admin/companies/${c.id}`)}
              className="grid cursor-pointer gap-3 border-b border-ds-rowDivider px-4 py-3.5 text-sm text-ds-text transition last:border-0 hover:bg-ds-surfaceLight"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.1fr 110px' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-dsAvatar bg-gradient-to-br from-ds-primary to-ds-primaryDark text-xs font-semibold text-white">
                  {c.name[0]}
                </div>
                <span className="font-medium">{c.name}</span>
              </div>
              <span>
                {c.subscription ? (
                  <span className="rounded-dsPill bg-ds-primaryLight px-2.5 py-1 text-xs text-ds-primaryDarker">
                    {PLAN_LABELS[c.subscription.plan] ?? c.subscription.plan}
                  </span>
                ) : (
                  <span className="text-ds-textDisabled">—</span>
                )}
              </span>
              <span className="num text-ds-textSecondary">{c.subscription?.seatsLimit ?? '—'}</span>
              <span className="text-ds-textSecondary">{c.industry ?? '—'}</span>
              <span className="num text-ds-textSecondary">{new Date(c.createdAt).toLocaleDateString('en-CA')}</span>
              <span>
                <span
                  className={`rounded-dsPill px-2.5 py-1 text-xs ${
                    c.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'
                  }`}
                >
                  {c.isActive ? 'نشطة' : 'مُعلَّقة'}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
