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
  DRAFT: 'bg-ds-trackBg text-ds-textMuted',
  ISSUED: 'bg-ds-primaryLight text-ds-primaryDarker',
  PAID: 'bg-ds-successBg text-ds-successText',
  OVERDUE: 'bg-ds-dangerBg text-ds-dangerText',
  VOID: 'bg-ds-trackBg text-ds-textDisabled line-through',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ISSUED: 'صادرة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  VOID: 'ملغاة',
};

export default function BillingV2Page() {
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
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الاشتراك والفوترة</h1>
      {error && <ErrorBanner message={error} />}

      {subscription ? (
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ds-primaryDarker">{subscription.plan.name}</h2>
                <span className={`rounded-dsPill px-2.5 py-0.5 text-xs font-semibold ${subscription.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'}`}>
                  {subscription.isActive ? 'نشط' : 'موقوف'}
                </span>
              </div>
              <p className="mt-1 text-sm text-ds-textSecondary">{BILLING_MODEL_LABELS[subscription.plan.billingModel] ?? subscription.plan.billingModel}</p>
              <p className="mt-3 num text-sm text-ds-textSecondary">
                فترة الاشتراك الحالية:{' '}
                <span className="font-medium text-ds-text">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString('en-CA')} — {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-CA')}
                </span>
              </p>
              <p className="num mt-1 text-sm">
                {daysRemaining > 0 ? (
                  <span className={daysRemaining <= 7 ? 'font-semibold text-ds-warningText' : 'text-ds-textSecondary'}>
                    {daysRemaining} يومًا متبقيًا على انتهاء الفترة الحالية
                  </span>
                ) : (
                  <span className="font-semibold text-ds-dangerText">انتهت فترة الاشتراك الحالية</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleRenew} disabled={actionBusy} className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm text-white shadow-dsButton disabled:opacity-50">
                تجديد الاشتراك
              </button>
              <button onClick={handleGenerateInvoice} disabled={actionBusy} className="rounded-dsField border border-ds-fieldBorder px-4 py-2 text-sm text-ds-textSecondary disabled:opacity-50">
                إنشاء فاتورة للفترة الحالية
              </button>
            </div>
          </div>

          {subscription.plan.featureLimits && subscription.plan.featureLimits.length > 0 && (
            <div className="mt-5 border-t border-ds-rowDivider pt-4">
              <p className="mb-2 text-sm font-medium text-ds-text">حدود الخطة</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {subscription.plan.featureLimits.map((fl) => (
                  <div key={fl.feature.code} className="flex items-center justify-between rounded-dsCardInner bg-ds-surfaceLight px-3 py-2 text-xs">
                    <span className="text-ds-textSecondary">{fl.feature.name}</span>
                    <span className="num font-semibold text-ds-text">{fl.includedLimit === null ? 'غير محدود' : fl.includedLimit.toLocaleString('en')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <p className="text-sm text-ds-textSecondary">لا يوجد اشتراك نشط لهذه الشركة بعد.</p>
        </div>
      )}

      {wallet && (
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <p className="text-sm text-ds-textSecondary">رصيد محفظة رموز الذكاء الاصطناعي</p>
          <p className="num mt-1 text-2xl font-bold text-ds-primaryDarker">{wallet.balanceTokens.toLocaleString('en')} رمز</p>
        </div>
      )}

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <p className="mb-3 text-sm font-semibold text-ds-text">الفواتير</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-ds-textMuted">لا توجد فواتير بعد.</p>
        ) : (
          <div className="divide-y divide-ds-rowDivider">
            {invoices.map((inv) => (
              <div key={inv.id}>
                <button onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)} className="flex w-full items-center justify-between py-3 text-right">
                  <div>
                    <p className="text-sm font-medium text-ds-text">{inv.invoiceNumber}</p>
                    <p className="num text-xs text-ds-textDisabled">
                      {new Date(inv.periodStart).toLocaleDateString('en-CA')} — {new Date(inv.periodEnd).toLocaleDateString('en-CA')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-dsPill px-2.5 py-0.5 text-xs font-semibold ${INVOICE_STATUS_STYLES[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span>
                    <span className="num text-sm font-bold text-ds-text">{inv.total.toLocaleString('en')} {inv.currency}</span>
                  </div>
                </button>

                {expandedInvoice === inv.id && (
                  <div className="mb-3 rounded-dsCardInner bg-ds-surfaceLight p-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {inv.lineItems.map((li) => (
                          <tr key={li.id} className="border-b border-ds-rowDivider last:border-0">
                            <td className="py-1.5 text-ds-textSecondary">{li.description}</td>
                            <td className="num py-1.5 text-left text-ds-text">{li.amount.toLocaleString('en')} {inv.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="num mt-2 space-y-1 border-t border-ds-rowDivider pt-2 text-xs">
                      <div className="flex justify-between text-ds-textMuted">
                        <span>المجموع الفرعي</span>
                        <span>{inv.subtotal.toLocaleString('en')} {inv.currency}</span>
                      </div>
                      {inv.discountTotal > 0 && (
                        <div className="flex justify-between text-ds-successText">
                          <span>الخصم</span>
                          <span>−{inv.discountTotal.toLocaleString('en')} {inv.currency}</span>
                        </div>
                      )}
                      {inv.taxTotal > 0 && (
                        <div className="flex justify-between text-ds-textMuted">
                          <span>الضريبة</span>
                          <span>{inv.taxTotal.toLocaleString('en')} {inv.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-ds-rowDivider pt-1 font-bold text-ds-text">
                        <span>الإجمالي</span>
                        <span>{inv.total.toLocaleString('en')} {inv.currency}</span>
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
