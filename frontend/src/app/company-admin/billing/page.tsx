'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { CompanySubscriptionInfo, Invoice, TokenWallet } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const BILLING_MODEL_LABELS: Record<string, string> = {
  PER_USER: 'حسب عدد المستخدمين',
  MONTHLY_TIER: 'اشتراك شهري ثابت',
  PAY_AS_YOU_GO: 'الدفع حسب الاستخدام',
  AI_TOKEN_PACKAGE: 'حزمة رموز الذكاء الاصطناعي',
  HYBRID: 'نموذج هجين',
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  OVERDUE: 'bg-red-50 text-red-700',
  VOID: 'bg-slate-100 text-slate-400 line-through',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ISSUED: 'صادرة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  VOID: 'ملغاة',
};

export default function BillingPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<CompanySubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [wallet, setWallet] = useState<TokenWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.companyId) return;
    setLoading(true);
    Promise.all([billingApi.getSubscription(user.companyId), billingApi.listInvoices(user.companyId), billingApi.getWallet(user.companyId)])
      .then(([sub, inv, w]) => {
        setSubscription(sub);
        setInvoices(inv);
        setWallet(w);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات الفوترة'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRenew() {
    if (!user?.companyId) return;
    setActionBusy(true);
    try {
      await billingApi.renewSubscription(user.companyId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تجديد الاشتراك');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!user?.companyId) return;
    setActionBusy(true);
    try {
      await billingApi.generateInvoice(user.companyId, { taxRatePercent: 15 });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء فاتورة');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <Loading />;

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold">الاشتراك والفوترة</h1>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* ---- Subscription status card ---- */}
      {subscription ? (
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-brand-700">{subscription.plan.name}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    subscription.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {subscription.isActive ? 'نشط' : 'موقوف'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{BILLING_MODEL_LABELS[subscription.plan.billingModel] ?? subscription.plan.billingModel}</p>
              <p className="mt-3 text-sm text-slate-600">
                فترة الاشتراك الحالية:{' '}
                <span className="font-medium">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString('ar')} — {new Date(subscription.currentPeriodEnd).toLocaleDateString('ar')}
                </span>
              </p>
              <p className="mt-1 text-sm">
                {daysRemaining > 0 ? (
                  <span className={daysRemaining <= 7 ? 'font-semibold text-amber-600' : 'text-slate-500'}>
                    {daysRemaining} يومًا متبقيًا على انتهاء الفترة الحالية
                  </span>
                ) : (
                  <span className="font-semibold text-red-600">انتهت فترة الاشتراك الحالية</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleRenew} disabled={actionBusy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                تجديد الاشتراك
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={actionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                إنشاء فاتورة للفترة الحالية
              </button>
            </div>
          </div>

          {subscription.plan.featureLimits && subscription.plan.featureLimits.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">حدود الخطة</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {subscription.plan.featureLimits.map((fl) => (
                  <div key={fl.feature.code} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs">
                    <span className="text-slate-600">{fl.feature.name}</span>
                    <span className="font-semibold text-slate-800">{fl.includedLimit === null ? 'غير محدود' : fl.includedLimit.toLocaleString('ar')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="text-sm text-slate-500">لا يوجد اشتراك نشط لهذه الشركة بعد.</p>
        </div>
      )}

      {/* ---- Token wallet ---- */}
      {wallet && (
        <div className="card mt-4">
          <p className="text-sm text-slate-500">رصيد محفظة رموز الذكاء الاصطناعي (Token Wallet)</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{wallet.balanceTokens.toLocaleString('ar')} رمز</p>
        </div>
      )}

      {/* ---- Invoices ---- */}
      <div className="card mt-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">الفواتير</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد فواتير بعد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv.id}>
                <button
                  onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                  className="flex w-full items-center justify-between py-3 text-right"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(inv.periodStart).toLocaleDateString('ar')} — {new Date(inv.periodEnd).toLocaleDateString('ar')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_STYLES[inv.status]}`}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {inv.total.toLocaleString('ar')} {inv.currency}
                    </span>
                  </div>
                </button>

                {expandedInvoice === inv.id && (
                  <div className="mb-3 rounded-md bg-slate-50 p-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {inv.lineItems.map((li) => (
                          <tr key={li.id} className="border-b border-slate-200 last:border-0">
                            <td className="py-1.5 text-slate-600">{li.description}</td>
                            <td className="py-1.5 text-left text-slate-800">
                              {li.amount.toLocaleString('ar')} {inv.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>المجموع الفرعي</span>
                        <span>
                          {inv.subtotal.toLocaleString('ar')} {inv.currency}
                        </span>
                      </div>
                      {inv.discountTotal > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>الخصم</span>
                          <span>
                            −{inv.discountTotal.toLocaleString('ar')} {inv.currency}
                          </span>
                        </div>
                      )}
                      {inv.taxTotal > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>الضريبة</span>
                          <span>
                            {inv.taxTotal.toLocaleString('ar')} {inv.currency}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800">
                        <span>الإجمالي</span>
                        <span>
                          {inv.total.toLocaleString('ar')} {inv.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
