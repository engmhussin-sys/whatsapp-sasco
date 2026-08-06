'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type BillingFeature } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import type { BillingPlan } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

type SimpleType = 'FIXED' | 'PER_USER' | 'USAGE' | 'HYBRID';

// B1 fix: أيقونات نصية بدل إيموجي (📅👥📊⚡) — نفس المبدأ المُطبَّق سابقًا.
const TYPE_OPTIONS: { value: SimpleType; icon: string; title: string; desc: string }[] = [
  { value: 'FIXED', icon: '▤', title: 'اشتراك شهري ثابت', desc: 'سعر واحد كل شهر، بلا أي حسابات إضافية — الأبسط' },
  { value: 'PER_USER', icon: '◫', title: 'بعدد المستخدمين', desc: 'سعر أساسي يشمل عددًا من المستخدمين + سعر منخفض لكل مستخدم إضافي' },
  { value: 'USAGE', icon: '◔', title: 'حسب الاستخدام', desc: 'بدون اشتراك ثابت — تدفع الشركة فقط مقابل ما تستخدمه فعليًا' },
  { value: 'HYBRID', icon: '◈', title: 'نموذج هجين', desc: 'اشتراك أساسي + مستخدمون إضافيون + استخدام ذكاء اصطناعي إضافي' },
];

const MAX_USERS_FEATURE = { code: 'max_users', name: 'عدد المستخدمين', unit: 'COUNT' as const };
const AI_TOKENS_FEATURE = { code: 'monthly_ai_tokens', name: 'رموز الذكاء الاصطناعي الشهرية', unit: 'TOKENS' as const };

function billingModelToSimple(model: string): SimpleType {
  const map: Record<string, SimpleType> = { MONTHLY_TIER: 'FIXED', PER_USER: 'PER_USER', PAY_AS_YOU_GO: 'USAGE', HYBRID: 'HYBRID', AI_TOKEN_PACKAGE: 'HYBRID' };
  return map[model] ?? 'FIXED';
}

export default function PlansV2Page() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [features, setFeatures] = useState<BillingFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [planName, setPlanName] = useState('');
  const [type, setType] = useState<SimpleType>('PER_USER');
  const [basePrice, setBasePrice] = useState('');
  const [includedUsers, setIncludedUsers] = useState('10');
  const [pricePerExtraUser, setPricePerExtraUser] = useState('');
  const [includedTokens, setIncludedTokens] = useState('10000');
  const [pricePerExtraToken, setPricePerExtraToken] = useState('');
  const [usageUnitPrice, setUsageUnitPrice] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([billingApi.listPlans(), billingApi.listFeatures()])
      .then(([p, f]) => {
        setPlans(p);
        setFeatures(f);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الخطط'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function ensureFeature(def: { code: string; name: string; unit: 'COUNT' | 'TOKENS' }) {
    const existing = features.find((f) => f.code === def.code);
    if (existing) return existing;
    const created = await billingApi.createFeature(def);
    setFeatures((prev) => [...prev, created]);
    return created;
  }

  function resetForm() {
    setPlanName('');
    setBasePrice('');
    setIncludedUsers('10');
    setPricePerExtraUser('');
    setIncludedTokens('10000');
    setPricePerExtraToken('');
    setUsageUnitPrice('');
  }

  async function handleCreate() {
    if (!planName.trim()) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const code = planName.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/(^-|-$)/g, '');
      const billingModelMap: Record<SimpleType, string> = { FIXED: 'MONTHLY_TIER', PER_USER: 'PER_USER', USAGE: 'PAY_AS_YOU_GO', HYBRID: 'HYBRID' };

      const plan = await billingApi.createPlan({
        code: code || `plan-${Date.now()}`,
        name: planName.trim(),
        billingModel: billingModelMap[type],
        basePrice: type === 'USAGE' ? 0 : parseFloat(basePrice || '0'),
      });

      if ((type === 'PER_USER' || type === 'HYBRID') && pricePerExtraUser) {
        const feature = await ensureFeature(MAX_USERS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, { featureCode: feature.code, includedLimit: parseInt(includedUsers, 10), overageUnitPrice: parseFloat(pricePerExtraUser) });
      }
      if (type === 'HYBRID' && pricePerExtraToken) {
        const feature = await ensureFeature(AI_TOKENS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, { featureCode: feature.code, includedLimit: parseInt(includedTokens, 10), overageUnitPrice: parseFloat(pricePerExtraToken) });
      }
      if (type === 'USAGE' && usageUnitPrice) {
        const feature = await ensureFeature(MAX_USERS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, { featureCode: feature.code, includedLimit: 0, overageUnitPrice: parseFloat(usageUnitPrice) });
      }

      setSuccessMsg(`تم إنشاء خطة "${planName.trim()}" بنجاح`);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الخطة');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إنشاء خطة اشتراك جديدة</h1>
        <p className="mt-1 text-sm text-ds-textSecondary">اختر طريقة المحاسبة، ثم حدّد الأسعار — بلا تعقيد.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {successMsg && <div className="rounded-dsCardInner bg-ds-successBg px-3 py-2 text-sm text-ds-successText">{successMsg}</div>}

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="planName">اسم الخطة</label>
        <input
          id="planName"
          placeholder="مثال: الخطة الاحترافية"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          className="mb-5 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
        />

        <p className="mb-1.5 text-sm font-medium text-ds-text">طريقة المحاسبة</p>
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`rounded-dsCard border-2 p-3 text-right transition ${type === opt.value ? 'border-ds-primary bg-ds-primaryLight' : 'border-ds-cardBorder hover:border-ds-fieldBorder'}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg text-ds-primary">{opt.icon}</span>
                <span className="text-sm font-bold text-ds-text">{opt.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-ds-textSecondary">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-ds-rowDivider pt-4">
          {type === 'FIXED' && (
            <div>
              <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="basePrice">السعر الشهري (ر.س)</label>
              <input id="basePrice" type="number" placeholder="مثال: 500" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
            </div>
          )}

          {type === 'PER_USER' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="basePrice2">السعر الأساسي الشهري (ر.س)</label>
                  <input id="basePrice2" type="number" placeholder="مثال: 300" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="includedUsers">عدد المستخدمين المشمولين</label>
                  <input id="includedUsers" type="number" value={includedUsers} onChange={(e) => setIncludedUsers(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="pricePerExtraUser">سعر كل مستخدم إضافي (ر.س / شهريًا)</label>
                <input id="pricePerExtraUser" type="number" placeholder="مثال: 15" value={pricePerExtraUser} onChange={(e) => setPricePerExtraUser(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
              </div>
              {basePrice && pricePerExtraUser && (
                <div className="num rounded-dsCardInner bg-ds-primaryLight px-3 py-2 text-xs text-ds-primaryDarker">
                  مثال: شركة بها {parseInt(includedUsers || '0', 10) + 5} مستخدمين ستدفع{' '}
                  <span className="font-bold">{(parseFloat(basePrice) + 5 * parseFloat(pricePerExtraUser)).toLocaleString('en')} ر.س</span> شهريًا
                  ({basePrice} أساسي + 5 مستخدمين إضافيين × {pricePerExtraUser})
                </div>
              )}
            </>
          )}

          {type === 'USAGE' && (
            <div>
              <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="usageUnitPrice">السعر لكل مستخدم فعليًا (ر.س / شهريًا)</label>
              <input id="usageUnitPrice" type="number" placeholder="مثال: 20" value={usageUnitPrice} onChange={(e) => setUsageUnitPrice(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
              <p className="mt-1 text-xs text-ds-textDisabled">لا يوجد اشتراك ثابت — الشركة تدفع فقط عن عدد المستخدمين الفعليين × هذا السعر</p>
            </div>
          )}

          {type === 'HYBRID' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="basePrice3">السعر الأساسي الشهري (ر.س)</label>
                  <input id="basePrice3" type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="includedUsers2">عدد المستخدمين المشمولين</label>
                  <input id="includedUsers2" type="number" value={includedUsers} onChange={(e) => setIncludedUsers(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="pricePerExtraUser2">سعر كل مستخدم إضافي (ر.س)</label>
                <input id="pricePerExtraUser2" type="number" value={pricePerExtraUser} onChange={(e) => setPricePerExtraUser(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="includedTokens">رموز ذكاء اصطناعي مشمولة شهريًا</label>
                  <input id="includedTokens" type="number" value={includedTokens} onChange={(e) => setIncludedTokens(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="pricePerExtraToken">سعر كل 1000 رمز إضافي (ر.س)</label>
                  <input id="pricePerExtraToken" type="number" value={pricePerExtraToken} onChange={(e) => setPricePerExtraToken(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={handleCreate} disabled={busy || !planName.trim()} className="mt-5 rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-6 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50">
          {busy ? 'جارٍ الإنشاء...' : 'إنشاء الخطة'}
        </button>
      </div>

      <h2 className="mt-2 text-sm font-bold text-ds-text">الخطط الحالية</h2>
      {plans.length === 0 ? (
        <p className="text-sm text-ds-textDisabled">لا توجد خطط بعد.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const usersLimit = p.featureLimits?.find((fl) => fl.feature.code === 'max_users');
            const tokensLimit = p.featureLimits?.find((fl) => fl.feature.code === 'monthly_ai_tokens');
            return (
              <div key={p.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
                <p className="font-bold text-ds-text">{p.name}</p>
                <p className="mt-0.5 text-xs text-ds-textDisabled">{TYPE_OPTIONS.find((t) => billingModelToSimple(p.billingModel) === t.value)?.title ?? p.billingModel}</p>
                <p className="num mt-3 text-2xl font-extrabold text-ds-primaryDarker">
                  {p.basePrice.toLocaleString('en')} <span className="text-sm font-normal text-ds-textDisabled">ر.س/شهريًا</span>
                </p>
                {usersLimit && (
                  <p className="num mt-2 text-xs text-ds-textSecondary">
                    يشمل {usersLimit.includedLimit ?? '∞'} مستخدم{usersLimit.overageUnitPrice ? ` — ${usersLimit.overageUnitPrice} ر.س لكل إضافي` : ''}
                  </p>
                )}
                {tokensLimit && <p className="num text-xs text-ds-textSecondary">يشمل {tokensLimit.includedLimit?.toLocaleString('en') ?? '∞'} رمز ذكاء اصطناعي</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
