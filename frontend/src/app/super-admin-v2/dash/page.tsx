'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

type Analytics = Awaited<ReturnType<typeof companiesApi.platformAnalytics>>;

export default function SuperAdminDashV2Page() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof companiesApi.platformStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([companiesApi.platformAnalytics(), companiesApi.platformStats()])
      .then(([a, s]) => {
        setAnalytics(a);
        setStats(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل البيانات'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!analytics || !stats) return <Loading />;

  const maxMrr = Math.max(...analytics.mrrByMonth.map((m) => m.total), 1);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">لوحة القيادة</h1>

      {/* ---- KPI row ---- */}
      <div className="grid grid-cols-4 gap-[14px]">
        <KpiCard label="الشركات" value={stats.companyCount} icon="◫" color="primary" />
        <KpiCard label="المستخدمون" value={stats.userCount} icon="◉" color="secondary" />
        <KpiCard label="الاشتراكات النشطة" value={analytics.activeSubscriptionCount} icon="◍" color="success" />
        <KpiCard
          label="إيراد الشهر الحالي"
          value={analytics.currentMonthMrr}
          suffix=" ر.س"
          icon="₪"
          color="primary"
          changePercent={analytics.mrrChangePercent}
        />
      </div>

      <div className="grid grid-cols-[1.55fr_1fr] gap-[14px]">
        {/* ---- MRR chart ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5 shadow-dsCard">
          <h2 className="mb-4 text-[15.5px] font-semibold tracking-[-.015em] text-ds-text">
            الإيراد الشهري المُحصَّل — آخر 12 شهرًا
          </h2>
          <div className="flex h-[140px] items-end gap-3">
            {analytics.mrrByMonth.map((m) => {
              const heightPercent = maxMrr > 0 ? (m.total / maxMrr) * 100 : 0;
              const [year, month] = m.month.split('-');
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="ds-grow w-full rounded-[3px] bg-gradient-to-t from-ds-primaryDark to-ds-primary"
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      title={`${m.total.toLocaleString('en')} ر.س`}
                    />
                  </div>
                  <span className="num text-[10.5px] text-ds-textMuted">
                    {month}/{year.slice(2)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="num mt-3 text-xs text-ds-textSecondary">
            الشهر الحالي: {analytics.currentMonthMrr.toLocaleString('en')} ر.س
          </p>
        </div>

        {/* ---- Placeholder for AI insights card — deliberately NOT built
             as fabricated AI output; see Sprint 3 notes in
             final-roadmap-16-sprints.md. Real rule-based insights only. ---- */}
        <div className="rounded-dsCard bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo p-5 text-ds-onDark shadow-dsDarkCard">
          <h2 className="mb-3 text-[15.5px] font-semibold">يحتاج قرارك</h2>
          {analytics.needsAttention.length === 0 ? (
            <p className="text-sm text-ds-onDarkSecondary">لا يوجد ما يحتاج قرارًا حاليًا</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {analytics.needsAttention.slice(0, 5).map((item) => (
                <div key={`${item.type}-${item.companyId}`} className="rounded-dsCardInner bg-white/5 p-3">
                  <p className="text-sm font-medium">{item.companyName}</p>
                  <p className="mt-0.5 text-xs text-ds-onDarkSecondary">
                    {item.type === 'trial_ending' ? 'تنتهي التجربة' : 'يتجدّد الاشتراك'} —{' '}
                    <span className="num">{new Date(item.date).toLocaleDateString('en-CA')}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  icon,
  color,
  changePercent,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  color: 'primary' | 'secondary' | 'success';
  changePercent?: number | null;
}) {
  const colorClasses = {
    primary: 'bg-ds-primaryLight text-ds-primary',
    secondary: 'bg-ds-secondaryBg text-ds-secondaryText',
    success: 'bg-ds-successBg text-ds-successText',
  }[color];

  return (
    <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5 shadow-dsCard">
      <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-[9px] ${colorClasses}`}>{icon}</div>
      <p className="mt-3 text-xs text-ds-textMuted">{label}</p>
      <p className="num mt-1 text-[30px] font-semibold leading-none text-ds-text">
        {value.toLocaleString('en')}
        {suffix}
      </p>
      {changePercent != null && (
        <span
          className={`num mt-2 inline-block rounded-dsPill px-2 py-0.5 text-[11px] font-medium ${
            changePercent >= 0 ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'
          }`}
        >
          {changePercent >= 0 ? '+' : ''}
          {changePercent.toFixed(1)}٪ مقارنة بالشهر الماضي
        </span>
      )}
    </div>
  );
}
