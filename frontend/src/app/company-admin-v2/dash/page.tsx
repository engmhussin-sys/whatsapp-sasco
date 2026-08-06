'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { reportsApi } from '@/lib/api/reports';
import { tasksApi, approvalsApi } from '@/lib/api/tasks';
import type {
  CompanyDashboardStats,
  CompanyOverviewReport,
  TranslationOverviewReport,
  TaskItem,
  ApprovalItem,
} from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import {
  DsCard,
  DsDarkCard,
  KpiCard,
  Chip,
  Meter,
  SkeletonCards,
  SkeletonRows,
  avatarGradient,
} from '@/components/ds/primitives';

/**
 * وردية اليوم — لوحة إدارة الشركة.
 *
 * صُحّحت لتطابق مواصفة التصميم §13: صف واحد من أربعة مؤشرات (أيقونة +
 * رقم + شريط)، ثم شريط تقدّم رباعي + ملخّص الوردية الداكن، ثم تدفّق مباشر
 * + الحضور وتوزّع اللغات.
 *
 * ما تغيّر عن النسخة المنشورة:
 *  · صفّان من ثمانية مؤشرات  →  صف واحد من أربعة (البقية داخل الأقسام)
 *  · أرقام ملوّنة (أخضر/تركوازي)  →  الرقم دائمًا بلون الحبر، والإشارة في شريحة
 *  · بطاقة كاملة بخلفية حمراء  →  بطاقة بيضاء والإشارة في الأيقونة والشريحة
 *  · دونات recharts بتنسيق المتصفّح  →  شريط رباعي بألوان النظام
 *  · سبنر  →  هياكل عظمية
 *  · إحصاء معلّق أسفل الصفحة  →  مدموج في المؤشرات
 */

const COMPLETED = ['SUBMITTED', 'APPROVED', 'COMPLETED'];
const IN_FLIGHT = ['ASSIGNED', 'IN_PROGRESS', 'RETURNED'];

const TASK_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ASSIGNED: 'مُسنَدة',
  IN_PROGRESS: 'قيد التنفيذ',
  SUBMITTED: 'مُرسَلة',
  APPROVED: 'مُعتمَدة',
  REJECTED: 'مرفوضة',
  RETURNED: 'مُعادة',
  COMPLETED: 'مكتملة',
  CANCELED: 'ملغاة',
};

const SOURCE_LABELS: Record<string, string> = {
  SAME_LANGUAGE: 'نفس اللغة (بلا ترجمة)',
  CACHE: 'ذاكرة مؤقتة',
  DICTIONARY: 'قاموس الشركة',
  MEMORY: 'ذاكرة الترجمة',
  PROVIDER: 'مزوّد الذكاء',
};

const LANG_COLORS = ['bg-ds-primaryDark', 'bg-ds-primary', 'bg-ds-secondary', 'bg-ds-coralTo', 'bg-ds-textDisabled'];

export default function CompanyAdminDashV2Page() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewReport | null>(null);
  const [translation, setTranslation] = useState<TranslationOverviewReport | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      companiesApi.dashboard(companyId),
      reportsApi.companyOverview(companyId),
      reportsApi.translationOverview(companyId).catch(() => null),
      tasksApi.list(companyId),
      approvalsApi.listMine(companyId),
    ])
      .then(([s, o, t, tk, ap]) => {
        setStats(s);
        setOverview(o);
        setTranslation(t);
        setTasks(tk);
        setApprovals(ap);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل لوحة الوردية'));
  }, [companyId]);

  const derived = useMemo(() => {
    if (!tasks || !overview) return null;
    const done = tasks.filter((t) => COMPLETED.includes(t.status));
    const overdue = tasks.filter(
      (t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && !COMPLETED.includes(t.status),
    );
    const inFlight = tasks.filter((t) => IN_FLIGHT.includes(t.status) && !overdue.includes(t));
    const notStarted = tasks.filter((t) => t.status === 'DRAFT');
    const total = Math.max(tasks.length, 1);
    return {
      done,
      overdue,
      inFlight,
      notStarted,
      completionRate: Math.round((done.length / total) * 100),
      seg: {
        done: (done.length / total) * 100,
        inFlight: (inFlight.length / total) * 100,
        overdue: (overdue.length / total) * 100,
        notStarted: (notStarted.length / total) * 100,
      },
    };
  }, [tasks, overview]);

  if (error) return <ErrorBanner message={error} />;

  if (!stats || !overview || !tasks || !approvals || !derived) {
    return (
      <div className="flex flex-col gap-[14px]">
        <SkeletonCards />
        <div className="grid grid-cols-[1.5fr_1fr] gap-[14px]">
          <div className="h-[300px] animate-pulse rounded-dsCard bg-ds-trackBg" />
          <div className="h-[300px] animate-pulse rounded-dsCard bg-ds-trackBg" />
        </div>
      </div>
    );
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
  const attendancePct = stats.totalUsers ? Math.round((overview.users.active / stats.totalUsers) * 100) : 0;
  const decisionsNeeded = overview.approvals.pending + overview.fuelRequests.pending;

  // تدفّق مباشر: أحدث المهام حركةً — من نفس القائمة، بلا نقطة نهاية جديدة.
  const feed = [...tasks]
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 5);

  const langTotal = stats.supportedLanguages.length;

  return (
    <div className="flex flex-col gap-[14px]">
      {/* ── الترويسة ── */}
      <div className="flex items-end gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">وردية اليوم</h1>
          <p className="num text-[13.5px] text-ds-textSecondary">
            {new Date().toLocaleDateString('en-CA')} · {overview.stations} محطة · {overview.teams} فريق ·{' '}
            {decisionsNeeded} بندًا يحتاج قرارك
          </p>
        </div>
        <div className="flex-1" />
        {decisionsNeeded > 0 && (
          <Link href="/company-admin-v2/approvals">
            <Chip tone="danger">
              <span className="num">{decisionsNeeded}</span> بندًا معلّقًا
            </Chip>
          </Link>
        )}
      </div>

      {/* ── صف واحد من أربعة مؤشرات ── */}
      <div className="grid grid-cols-4 gap-[14px]">
        <KpiCard
          label="مهام الوردية"
          value={tasks.length.toLocaleString('en-US')}
          unit="مهمة"
          icon="▤"
          tone="primary"
          deltaLabel={`${derived.done.length} مكتملة`}
          deltaTone="success"
          footnote={`${derived.inFlight.length} قيد التنفيذ`}
        />
        <KpiCard
          label="نسبة الإنجاز"
          value={`${derived.completionRate}%`}
          icon="✓"
          tone="success"
          deltaLabel={`${derived.notStarted.length} لم تبدأ`}
          deltaTone="success"
          footnote="من مهام الوردية"
        />
        <KpiCard
          label="الحضور الآن"
          value={overview.users.active.toLocaleString('en-US')}
          unit={`من ${stats.totalUsers.toLocaleString('en-US')}`}
          icon="◷"
          tone="secondary"
          deltaLabel={`${attendancePct}%`}
          deltaTone="success"
          footnote="من إجمالي المستخدمين"
        />
        <KpiCard
          label="مهام متأخرة"
          value={derived.overdue.length.toLocaleString('en-US')}
          unit="تحتاج إسنادًا"
          icon="!"
          tone={derived.overdue.length > 0 ? 'danger' : 'neutral'}
          deltaLabel={derived.overdue.length > 0 ? 'تدخّل مطلوب' : 'لا تأخير'}
          deltaTone={derived.overdue.length > 0 ? 'danger' : 'success'}
          footnote="مقابل تاريخ الاستحقاق"
        />
      </div>

      {/* ── تقدّم الوردية + ملخّص الوردية ── */}
      <div className="grid grid-cols-[1.5fr_1fr] items-start gap-[14px]">
        <DsCard className="p-[22px]">
          <div className="mb-5 flex items-center">
            <div>
              <h2 className="text-[15.5px] font-semibold tracking-[-.015em] text-ds-text">تقدّم الوردية</h2>
              <p className="text-[12.5px] text-ds-textSecondary">توزيع مهام الوردية على حالاتها</p>
            </div>
            <div className="flex-1" />
            <span className="num text-[12px] text-ds-textMuted">
              {derived.done.length}/{tasks.length}
            </span>
          </div>

          {/* الشريط الرباعي — بدل دونات recharts بتنسيق المتصفّح */}
          <div className="flex h-2.5 gap-[3px] overflow-hidden">
            <Seg pct={derived.seg.done} className="rounded-s-[5px] bg-ds-success" title="مكتملة" />
            <Seg pct={derived.seg.inFlight} className="bg-ds-primary" title="قيد التنفيذ" />
            <Seg pct={derived.seg.overdue} className="bg-ds-danger" title="متأخرة" />
            <Seg pct={derived.seg.notStarted} className="rounded-e-[5px] bg-ds-cardBorder" title="لم تبدأ" />
          </div>

          <div className="mt-5 flex flex-wrap gap-4.5 border-t border-ds-rowDivider2 pt-4 text-xs text-ds-textSecondary">
            <Legend color="bg-ds-success" label="مكتملة" n={derived.done.length} />
            <Legend color="bg-ds-primary" label="قيد التنفيذ" n={derived.inFlight.length} />
            <Legend color="bg-ds-danger" label="متأخرة" n={derived.overdue.length} />
            <Legend color="bg-ds-cardBorder" label="لم تبدأ" n={derived.notStarted.length} />
          </div>

          {/* التفصيل الكامل حسب الحالة من التقرير */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {Object.entries(overview.tasksByStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-baseline gap-2 rounded-dsCardInner border border-ds-rowDivider2 bg-ds-surfaceLight px-3 py-2.5"
                >
                  <span className="flex-1 text-[12.5px] text-ds-textSecondary">
                    {TASK_STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="num text-[15px] font-semibold text-ds-text">{count.toLocaleString('en-US')}</span>
                </div>
              ))}
          </div>

          <p className="mt-4 text-[11.5px] leading-relaxed text-ds-textMuted">
            التقدّم <strong>حسب الموقع</strong> (مصنع/خط) يحتاج{' '}
            <code className="num">GET /reports/:companyId/tasks-by-site</code> — غير متاح بعد، فيُعرض التوزيع حسب
            الحالة بدلًا منه.
          </p>
        </DsCard>

        {/* ملخّص الوردية — قواعد حقيقية على بيانات حقيقية، لا مخرجات ذكاء ملفّقة */}
        <DsDarkCard className="flex flex-col p-[22px]">
          <div className="mb-4.5 flex items-center gap-2.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[9px] bg-gradient-to-br from-ds-primary to-ds-secondary text-xs">
              ✦
            </span>
            <span className="flex-1 text-[13.5px] font-medium">ملخّص الوردية</span>
            <span className="rounded-dsPill bg-ds-secondary/15 px-2 py-0.5 text-[10.5px] text-ds-secondary">
              قواعد آلية
            </span>
          </div>

          <p className="text-[13.5px] leading-[1.75] text-[#E4E5EF]">
            أُنجزت <span className="num font-medium text-white">{derived.completionRate}%</span> من مهام الوردية،
            و
            <span className="num font-medium text-white">{overview.users.active}</span> من{' '}
            <span className="num font-medium text-white">{stats.totalUsers}</span> مستخدمًا نشطون الآن.
            {derived.overdue.length > 0 ? (
              <>
                {' '}
                الاختناق في <span className="font-medium text-white">{derived.overdue.length} مهمة متأخرة</span> تجاوزت
                تاريخ استحقاقها ولم تُنجَز.
              </>
            ) : (
              ' لا مهام متأخرة — الوردية على مسارها.'
            )}
          </p>

          <div className="mt-4.5 flex flex-col gap-2.5">
            {derived.overdue.length > 0 && (
              <Suggestion
                text={`أعِد إسناد ${derived.overdue.length} مهمة متأخرة`}
                cta="افتح المهام"
                href="/company-admin-v2/tasks"
              />
            )}
            {pendingApprovals.length > 0 && (
              <Suggestion
                text={`${pendingApprovals.length} موافقة بانتظار قرارك`}
                cta="راجع"
                href="/company-admin-v2/approvals"
              />
            )}
            {overview.fuelRequests.pending > 0 && (
              <Suggestion
                text={`${overview.fuelRequests.pending} طلب وقود معلَّق`}
                cta="افتح"
                href="/company-admin-v2/approvals"
              />
            )}
            {derived.overdue.length === 0 && pendingApprovals.length === 0 && overview.fuelRequests.pending === 0 && (
              <p className="text-[12.5px] text-ds-onDarkSecondary">لا إجراءات مقترحة — لا شيء معلَّق.</p>
            )}
          </div>

          <div className="flex-1" />
          <div className="mt-4 flex items-center gap-2.5 rounded-dsField border border-white/[.08] bg-white/[.06] px-3.5 py-2.5">
            <span className="flex-1 text-[12.5px] text-ds-onDarkSecondary">
              سؤال حرّ عن بيانات الوردية يحتاج وحدة الذكاء
            </span>
            <span className="num rounded-md bg-white/[.12] px-1.5 py-0.5 text-[10px]">↵</span>
          </div>
        </DsDarkCard>
      </div>

      {/* ── تدفّق مباشر + الحضور واللغات ── */}
      <div className="grid grid-cols-[1.35fr_1fr] items-start gap-[14px]">
        <DsCard className="overflow-hidden">
          <div className="flex items-center px-5 pb-3.5 pt-[18px]">
            <h2 className="flex-1 text-[15.5px] font-semibold tracking-[-.015em] text-ds-text">تدفّق مباشر</h2>
            <span className="flex items-center gap-2 text-xs text-ds-successText">
              <span className="ds-pulse h-[7px] w-[7px] rounded-full bg-ds-success" />
              مباشر
            </span>
          </div>

          {feed.length === 0 ? (
            <p className="px-5 pb-6 text-[13px] text-ds-textSecondary">لا حركة على المهام بعد.</p>
          ) : (
            feed.map((t, i) => {
              const overdue = derived.overdue.includes(t);
              const done = COMPLETED.includes(t.status);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3.5 border-t border-ds-rowDivider px-5 py-3.5 transition hover:bg-ds-surfaceLight"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br text-xs font-semibold text-white ${avatarGradient(
                      i,
                    )}`}
                  >
                    {(t.assignments?.[0]?.user.firstName ?? t.title).charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-ds-text">{t.title}</p>
                    <p className="num text-[11.5px] text-ds-textSecondary">
                      {t.assignments?.[0]?.user ? `${t.assignments[0].user.firstName} ${t.assignments[0].user.lastName} · ` : ''}
                      {new Date(t.updatedAt ?? t.createdAt).toLocaleDateString('en-CA')}
                    </p>
                  </div>
                  <Chip tone={overdue ? 'danger' : done ? 'success' : 'primary'}>
                    {overdue ? 'متأخرة' : (TASK_STATUS_LABELS[t.status] ?? t.status)}
                  </Chip>
                </div>
              );
            })
          )}
        </DsCard>

        <DsCard className="p-5">
          <div className="mb-4.5 flex items-center">
            <h2 className="flex-1 text-[15.5px] font-semibold tracking-[-.015em] text-ds-text">القوى العاملة</h2>
            <span className="num text-xs text-ds-textMuted">
              {overview.users.active} / {stats.totalUsers}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            <Meter
              label="نشط الآن"
              valueLabel={`${attendancePct}%`}
              percent={attendancePct}
              color="bg-ds-success"
            />
            <Meter
              label="الفرق"
              valueLabel={overview.teams.toLocaleString('en-US')}
              percent={Math.min(100, overview.teams * 10)}
              color="bg-ds-primary"
            />
            <Meter
              label="المحطات"
              valueLabel={overview.stations.toLocaleString('en-US')}
              percent={Math.min(100, overview.stations * 10)}
              color="bg-ds-secondary"
            />
          </div>

          {/* توزّع اللغات — شريط واحد بارتفاع 34px */}
          <div className="mt-5 border-t border-ds-rowDivider2 pt-4">
            <p className="mb-2.5 text-xs text-ds-textSecondary">اللغات المفعّلة في هذه الشركة</p>
            {langTotal === 0 ? (
              <p className="text-[12.5px] text-ds-textMuted">لم تُفعّل أي لغة بعد.</p>
            ) : (
              <>
                <div className="flex h-[34px] gap-[3px] overflow-hidden rounded-[9px]">
                  {stats.supportedLanguages.map((lang, i) => (
                    <span
                      key={lang.code}
                      className={`flex items-center justify-center overflow-hidden text-[10.5px] whitespace-nowrap text-white ${
                        LANG_COLORS[i % LANG_COLORS.length]
                      }`}
                      style={{ width: `${100 / langTotal}%` }}
                      title={`${lang.nativeName} (${lang.code})`}
                    >
                      {lang.nativeName}
                    </span>
                  ))}
                </div>
                <p className="num mt-2.5 text-[11.5px] text-ds-textMuted">
                  {langTotal} لغة نشطة — كل رسالة تُترجم إلى لغة مستلمها.
                </p>
              </>
            )}

            {translation && (
              <div className="mt-4 border-t border-ds-rowDivider2 pt-4">
                <div className="mb-2.5 flex items-baseline">
                  <span className="flex-1 text-xs text-ds-textSecondary">إصابة ذاكرة الترجمة</span>
                  <span className="num text-[15px] font-semibold text-ds-text">{translation.cacheHitRate}%</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(translation.byResolutionSource).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-ds-textMuted">{SOURCE_LABELS[source] ?? source}</span>
                      <span className="num font-medium text-ds-text">{count.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
                <p className="num mt-2.5 text-[11px] text-ds-textMuted">
                  {translation.totalCalls} طلب ترجمة آخر 30 يومًا · {overview.messagesLast30Days} رسالة
                </p>
              </div>
            )}
          </div>
        </DsCard>
      </div>
    </div>
  );
}

function Seg({ pct, className, title }: { pct: number; className: string; title: string }) {
  if (pct <= 0) return null;
  return <span className={className} style={{ width: `${pct}%` }} title={title} />;
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
      <span className="num font-medium text-ds-text">{n.toLocaleString('en-US')}</span>
    </span>
  );
}

function Suggestion({ text, cta, href }: { text: string; cta: string; href: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[13px] border border-white/[.07] bg-white/5 px-3.5 py-3 transition hover:bg-white/10">
      <span className="flex-1 text-[12.5px] text-[#E4E5EF]">{text}</span>
      <Link
        href={href}
        className="whitespace-nowrap rounded-[9px] border border-white/[.16] px-2.5 py-1 text-[11.5px] text-white transition hover:bg-white/[.14]"
      >
        {cta}
      </Link>
    </div>
  );
}
