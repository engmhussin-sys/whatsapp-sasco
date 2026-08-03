'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type BillingFeature } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import type { BillingPlan } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

type SimpleType = 'FIXED' | 'PER_USER' | 'USAGE' | 'HYBRID';

const TYPE_OPTIONS: { value: SimpleType; icon: string; title: string; desc: string }[] = [
  { value: 'FIXED', icon: '📅', title: 'اشتراك شهري ثابت', desc: 'سعر واحد كل شهر، بلا أي حسابات إضافية — الأبسط' },
  { value: 'PER_USER', icon: '👥', title: 'بعدد المستخدمين', desc: 'سعر أساسي يشمل عددًا من المستخدمين + سعر منخفض لكل مستخدم إضافي' },
  { value: 'USAGE', icon: '📊', title: 'حسب الاستخدام', desc: 'بدون اشتراك ثابت — تدفع الشركة فقط مقابل ما تستخدمه فعليًا' },
  { value: 'HYBRID', icon: '⚡', title: 'نموذج هجين', desc: 'اشتراك أساسي + مستخدمون إضافيون + استخدام ذكاء اصطناعي إضافي' },
];

const MAX_USERS_FEATURE = { code: 'max_users', name: 'عدد المستخدمين', unit: 'COUNT' as const };
const AI_TOKENS_FEATURE = { code: 'monthly_ai_tokens', name: 'رموز الذكاء الاصطناعي الشهرية', unit: 'TOKENS' as const };

export default function PlansPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [features, setFeatures] = useState<BillingFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ---- Simplified form state ----
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

  /** Creates the standard "max_users" / "monthly_ai_tokens" features the FIRST time they're needed — the admin never has to think about this step. */
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
      const billingModelMap: Record<SimpleType, string> = {
        FIXED: 'MONTHLY_TIER',
        PER_USER: 'PER_USER',
        USAGE: 'PAY_AS_YOU_GO',
        HYBRID: 'HYBRID',
      };

      const plan = await billingApi.createPlan({
        code: code || `plan-${Date.now()}`,
        name: planName.trim(),
        billingModel: billingModelMap[type],
        basePrice: type === 'USAGE' ? 0 : parseFloat(basePrice || '0'),
      });

      // Users limit — for PER_USER and HYBRID
      if ((type === 'PER_USER' || type === 'HYBRID') && pricePerExtraUser) {
        const feature = await ensureFeature(MAX_USERS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, {
          featureCode: feature.code,
          includedLimit: parseInt(includedUsers, 10),
          overageUnitPrice: parseFloat(pricePerExtraUser),
        });
      }

      // AI tokens limit — for HYBRID
      if (type === 'HYBRID' && pricePerExtraToken) {
        const feature = await ensureFeature(AI_TOKENS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, {
          featureCode: feature.code,
          includedLimit: parseInt(includedTokens, 10),
          overageUnitPrice: parseFloat(pricePerExtraToken),
        });
      }

      // Pure usage-based — everything is "overage" from zero, no included amount
      if (type === 'USAGE' && usageUnitPrice) {
        const feature = await ensureFeature(MAX_USERS_FEATURE);
        await billingApi.setPlanFeatureLimit(plan.code, {
          featureCode: feature.code,
          includedLimit: 0,
          overageUnitPrice: parseFloat(usageUnitPrice),
        });
      }

      setSuccessMsg(`✅ تم إنشاء خطة "${planName.trim()}" بنجاح`);
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
    <div>
      <h1 className="mb-1 text-lg font-bold">إنشاء خطة اشتراك جديدة</h1>
      <p className="mb-5 text-sm text-ink-500">اختر طريقة المحاسبة، ثم حدّد الأسعار — بلا تعقيد.</p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {successMsg && <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{successMsg}</div>}

      <div className="card">
        {/* ---- Step 1: Plan name ---- */}
        <label className="label" htmlFor="planName">
          اسم الخطة
        </label>
        <input id="planName" className="input mb-5" placeholder="مثال: الخطة الاحترافية" value={planName} onChange={(e) => setPlanName(e.target.value)} />

        {/* ---- Step 2: Billing type — clear cards, not a dropdown ---- */}
        <p className="label">طريقة المحاسبة</p>
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`rounded-xl border-2 p-3 text-right transition ${
                type === opt.value ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-ink-200'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">{opt.icon}</span>
                <span className="text-sm font-bold text-ink-900">{opt.title}</span>
              </div>
              <p className="text-xs leading-relaxed text-ink-500">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* ---- Step 3: Simple, type-specific fields ---- */}
        <div className="space-y-4 border-t border-ink-100 pt-4">
          {type === 'FIXED' && (
            <div>
              <label className="label" htmlFor="basePrice">
                السعر الشهري (ر.س)
              </label>
              <input id="basePrice" type="number" className="input" placeholder="مثال: 500" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
          )}

          {type === 'PER_USER' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="basePrice2">
                    السعر الأساسي الشهري (ر.س)
                  </label>
                  <input id="basePrice2" type="number" className="input" placeholder="مثال: 300" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="includedUsers">
                    عدد المستخدمين المشمولين
                  </label>
                  <input id="includedUsers" type="number" className="input" value={includedUsers} onChange={(e) => setIncludedUsers(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="pricePerExtraUser">
                  سعر كل مستخدم إضافي (ر.س / شهريًا)
                </label>
                <input
                  id="pricePerExtraUser"
                  type="number"
                  className="input"
                  placeholder="مثال: 15 (سعر منخفض لكل مستخدم يزيد عن الحد)"
                  value={pricePerExtraUser}
                  onChange={(e) => setPricePerExtraUser(e.target.value)}
                />
              </div>
              {basePrice && pricePerExtraUser && (
                <div className="rounded-lg bg-accent-400/10 px-3 py-2 text-xs text-ink-700">
                  مثال: شركة بها {parseInt(includedUsers || '0', 10) + 5} مستخدمين ستدفع{' '}
                  <span className="font-bold">
                    {(parseFloat(basePrice) + 5 * parseFloat(pricePerExtraUser)).toLocaleString('ar')} ر.س
                  </span>{' '}
                  شهريًا ({basePrice} أساسي + 5 مستخدمين إضافيين × {pricePerExtraUser})
                </div>
              )}
            </>
          )}

          {type === 'USAGE' && (
            <div>
              <label className="label" htmlFor="usageUnitPrice">
                السعر لكل مستخدم فعليًا (ر.س / شهريًا)
              </label>
              <input
                id="usageUnitPrice"
                type="number"
                className="input"
                placeholder="مثال: 20"
                value={usageUnitPrice}
                onChange={(e) => setUsageUnitPrice(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-400">لا يوجد اشتراك ثابت — الشركة تدفع فقط عن عدد المستخدمين الفعليين × هذا السعر</p>
            </div>
          )}

          {type === 'HYBRID' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="basePrice3">
                    السعر الأساسي الشهري (ر.س)
                  </label>
                  <input id="basePrice3" type="number" className="input" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="includedUsers2">
                    عدد المستخدمين المشمولين
                  </label>
                  <input id="includedUsers2" type="number" className="input" value={includedUsers} onChange={(e) => setIncludedUsers(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="pricePerExtraUser2">
                  سعر كل مستخدم إضافي (ر.س)
                </label>
                <input id="pricePerExtraUser2" type="number" className="input" value={pricePerExtraUser} onChange={(e) => setPricePerExtraUser(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="includedTokens">
                    رموز ذكاء اصطناعي مشمولة شهريًا
                  </label>
                  <input id="includedTokens" type="number" className="input" value={includedTokens} onChange={(e) => setIncludedTokens(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="pricePerExtraToken">
                    سعر كل 1000 رمز إضافي (ر.س)
                  </label>
                  <input id="pricePerExtraToken" type="number" className="input" value={pricePerExtraToken} onChange={(e) => setPricePerExtraToken(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={handleCreate} disabled={busy || !planName.trim()} className="btn-primary mt-5">
          {busy ? 'جارٍ الإنشاء...' : 'إنشاء الخطة'}
        </button>
      </div>

      {/* ---- Existing plans — simplified summary cards instead of a technical table ---- */}
      <h2 className="mb-3 mt-8 text-sm font-bold text-ink-900">الخطط الحالية</h2>
      {plans.length === 0 ? (
        <p className="text-sm text-ink-400">لا توجد خطط بعد.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const usersLimit = p.featureLimits?.find((fl) => fl.feature.code === 'max_users');
            const tokensLimit = p.featureLimits?.find((fl) => fl.feature.code === 'monthly_ai_tokens');
            return (
              <div key={p.id} className="card">
                <p className="font-bold text-ink-900">{p.name}</p>
                <p className="mt-0.5 text-xs text-ink-400">{TYPE_OPTIONS.find((t) => billingModelToSimple(p.billingModel) === t.value)?.title ?? p.billingModel}</p>
                <p className="mt-3 text-2xl font-extrabold text-brand-600">
                  {p.basePrice.toLocaleString('ar')} <span className="text-sm font-normal text-ink-400">ر.س/شهريًا</span>
                </p>
                {usersLimit && (
                  <p className="mt-2 text-xs text-ink-500">
                    يشمل {usersLimit.includedLimit ?? '∞'} مستخدم
                    {usersLimit.overageUnitPrice ? ` — ${usersLimit.overageUnitPrice} ر.س لكل إضافي` : ''}
                  </p>
                )}
                {tokensLimit && (
                  <p className="text-xs text-ink-500">
                    يشمل {tokensLimit.includedLimit?.toLocaleString('ar') ?? '∞'} رمز ذكاء اصطناعي
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function billingModelToSimple(model: string): SimpleType {
  const map: Record<string, SimpleType> = { MONTHLY_TIER: 'FIXED', PER_USER: 'PER_USER', PAY_AS_YOU_GO: 'USAGE', HYBRID: 'HYBRID', AI_TOKEN_PACKAGE: 'HYBRID' };
  return map[model] ?? 'FIXED';
}
