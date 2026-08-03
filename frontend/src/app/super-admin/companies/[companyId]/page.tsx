'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { companiesApi } from '@/lib/api/companies';
import { billingApi } from '@/lib/api/billing';
import { reportsApi } from '@/lib/api/reports';
import { ApiError } from '@/lib/api-client';
import type { Company, CompanySubscriptionInfo, Invoice, BillingPlan, TokenWallet, CompanyOverviewReport } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-ink-100 text-ink-600',
  ISSUED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-brand-50 text-brand-700',
  OVERDUE: 'bg-red-50 text-red-700',
  VOID: 'bg-ink-100 text-ink-400 line-through',
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ISSUED: 'صادرة — بانتظار التحصيل',
  PAID: 'مُحصَّلة',
  OVERDUE: 'متأخرة',
  VOID: 'ملغاة',
};

export default function CompanyBillingManagementPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<CompanySubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [wallet, setWallet] = useState<TokenWallet | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewReport | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [walletCreditAmount, setWalletCreditAmount] = useState('');

  const load = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      companiesApi.get(companyId),
      billingApi.getSubscription(companyId).catch(() => null),
      billingApi.listInvoices(companyId).catch(() => []),
      billingApi.getWallet(companyId).catch(() => null),
      reportsApi.companyOverview(companyId).catch(() => null),
      billingApi.listPlans(),
    ])
      .then(([c, sub, inv, w, ov, pl]) => {
        setCompany(c);
        setSubscription(sub);
        setInvoices(inv);
        setWallet(w);
        setOverview(ov);
        setPlans(pl);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات الشركة'))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssignPlan() {
    if (!selectedPlanCode) return;
    setBusy(true);
    setNotice(null);
    try {
      await billingApi.subscribe(companyId, selectedPlanCode);
      setNotice('✅ تم تحديث خطة الشركة بنجاح');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تحديث الخطة');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateInvoice() {
    setBusy(true);
    setNotice(null);
    try {
      await billingApi.generateInvoice(companyId, { taxRatePercent: 15 });
      setNotice('✅ أُنشئت فاتورة جديدة');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الفاتورة');
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueInvoice(invoiceId: string) {
    setBusy(true);
    try {
      await billingApi.issueInvoice(companyId, invoiceId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إصدار الفاتورة');
    } finally {
      setBusy(false);
    }
  }

  /** "Collection" — marking an invoice as paid once payment has actually been received (bank transfer, cheque, etc.) */
  async function handleMarkPaid(invoiceId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await billingApi.markInvoicePaid(companyId, invoiceId);
      setNotice('✅ سُجِّل التحصيل — الفاتورة الآن "مُحصَّلة"');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تسجيل التحصيل');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreditWallet() {
    if (!walletCreditAmount) return;
    setBusy(true);
    try {
      await billingApi.creditWallet(companyId, parseFloat(walletCreditAmount), 'إضافة يدوية من مدير المنصة');
      setWalletCreditAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إضافة الرصيد');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!company) return <ErrorBanner message="الشركة غير موجودة" />;

  const outstandingTotal = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);
  const collectedTotal = invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">{company.name}</h1>
      <p className="mb-5 text-sm text-ink-500">إدارة الخطة، الفواتير، التحصيل، والاستهلاك لهذه الشركة</p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {notice && <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</div>}

      {/* ---- Collection summary — the headline numbers for "التحصيل" ---- */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-ink-500">مبالغ مُحصَّلة</p>
          <p className="mt-1 text-2xl font-bold text-brand-600">{collectedTotal.toLocaleString('ar')} ر.س</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-500">مبالغ مستحقة (غير مُحصَّلة)</p>
          <p className={`mt-1 text-2xl font-bold ${outstandingTotal > 0 ? 'text-amber-600' : 'text-ink-400'}`}>
            {outstandingTotal.toLocaleString('ar')} ر.س
          </p>
        </div>
        {wallet && (
          <div className="card">
            <p className="text-sm text-ink-500">رصيد رموز الذكاء الاصطناعي</p>
            <p className="mt-1 text-2xl font-bold text-brand-600">{wallet.balanceTokens.toLocaleString('ar')}</p>
          </div>
        )}
      </div>

      {/* ---- Plan management — "تعديل خطة الشركة" ---- */}
      <div className="card mb-6">
        <p className="mb-3 text-sm font-semibold text-ink-900">خطة الاشتراك</p>
        {subscription ? (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2.5">
            <div>
              <p className="text-sm font-bold text-ink-900">{subscription.plan.name}</p>
              <p className="text-xs text-ink-400">
                ينتهي: {new Date(subscription.currentPeriodEnd).toLocaleDateString('ar')} — {subscription.isActive ? 'نشط' : 'موقوف'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-3 text-sm text-ink-400">لا يوجد اشتراك بعد لهذه الشركة.</p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="planSelect">
              {subscription ? 'تغيير الخطة إلى' : 'اختر خطة لتفعيلها'}
            </label>
            <select id="planSelect" className="input" value={selectedPlanCode} onChange={(e) => setSelectedPlanCode(e.target.value)}>
              <option value="">اختر خطة...</option>
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} — {p.basePrice.toLocaleString('ar')} ر.س
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAssignPlan} disabled={busy || !selectedPlanCode} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">
            {subscription ? 'تحديث الخطة' : 'تفعيل الاشتراك'}
          </button>
        </div>
      </div>

      {/* ---- Usage summary — "حصر الاستهلاك" ---- */}
      {overview && (
        <div className="card mb-6">
          <p className="mb-3 text-sm font-semibold text-ink-900">حصر الاستهلاك الحالي</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <UsageStat label="المستخدمون" value={`${overview.users.active} / ${overview.users.total}`} />
            <UsageStat label="الفرق" value={overview.teams} />
            <UsageStat label="المحطات" value={overview.stations} />
            <UsageStat label="رسائل (30 يومًا)" value={overview.messagesLast30Days} />
          </div>
        </div>
      )}

      {/* ---- Token wallet top-up ---- */}
      <div className="card mb-6">
        <p className="mb-3 text-sm font-semibold text-ink-900">إضافة رصيد رموز ذكاء اصطناعي يدويًا</p>
        <div className="flex gap-2">
          <input type="number" className="input" placeholder="الكمية" value={walletCreditAmount} onChange={(e) => setWalletCreditAmount(e.target.value)} />
          <button onClick={handleCreditWallet} disabled={busy || !walletCreditAmount} className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">
            إضافة
          </button>
        </div>
      </div>

      {/* ---- Invoices & Collection ---- */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">الفواتير والتحصيل</p>
          <button onClick={handleGenerateInvoice} disabled={busy} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 disabled:opacity-50">
            + إنشاء فاتورة جديدة
          </button>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-ink-400">لا توجد فواتير بعد.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">{inv.invoiceNumber}</p>
                  <p className="text-xs text-ink-400">{new Date(inv.createdAt).toLocaleDateString('ar')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_STYLES[inv.status]}`}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </span>
                  <span className="text-sm font-bold text-ink-800">
                    {inv.total.toLocaleString('ar')} {inv.currency}
                  </span>
                  {inv.status === 'DRAFT' && (
                    <button onClick={() => handleIssueInvoice(inv.id)} disabled={busy} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      إصدار
                    </button>
                  )}
                  {inv.status === 'ISSUED' && (
                    <button onClick={() => handleMarkPaid(inv.id)} disabled={busy} className="rounded-lg bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                      تسجيل التحصيل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
