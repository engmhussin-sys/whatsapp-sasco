'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type BillingFeature, type AddOn } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import type { BillingPlan } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const BILLING_MODELS = [
  { value: 'PER_USER', label: 'حسب عدد المستخدمين' },
  { value: 'MONTHLY_TIER', label: 'اشتراك شهري ثابت' },
  { value: 'PAY_AS_YOU_GO', label: 'الدفع حسب الاستخدام' },
  { value: 'AI_TOKEN_PACKAGE', label: 'حزمة رموز ذكاء اصطناعي' },
  { value: 'HYBRID', label: 'نموذج هجين' },
];

const FEATURE_UNITS = [
  { value: 'COUNT', label: 'عدد' },
  { value: 'TOKENS', label: 'رموز (Tokens)' },
  { value: 'GB', label: 'جيجابايت' },
  { value: 'MINUTES', label: 'دقائق' },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [features, setFeatures] = useState<BillingFeature[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // New plan form
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [planModel, setPlanModel] = useState('MONTHLY_TIER');
  const [planPrice, setPlanPrice] = useState('');

  // New feature form
  const [featureCode, setFeatureCode] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featureUnit, setFeatureUnit] = useState('COUNT');

  // Assign limit form
  const [limitPlanCode, setLimitPlanCode] = useState('');
  const [limitFeatureCode, setLimitFeatureCode] = useState('');
  const [limitValue, setLimitValue] = useState('');
  const [limitUnlimited, setLimitUnlimited] = useState(false);
  const [overagePrice, setOveragePrice] = useState('');

  // New add-on form
  const [addOnCode, setAddOnCode] = useState('');
  const [addOnName, setAddOnName] = useState('');
  const [addOnPrice, setAddOnPrice] = useState('');
  const [addOnFeatureCode, setAddOnFeatureCode] = useState('');
  const [addOnExtraLimit, setAddOnExtraLimit] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([billingApi.listPlans(), billingApi.listFeatures(), billingApi.listAddOnCatalog()])
      .then(([p, f, a]) => {
        setPlans(p);
        setFeatures(f);
        setAddOns(a);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الخطط'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreatePlan() {
    if (!planCode.trim() || !planName.trim() || !planPrice) return;
    setBusy(true);
    try {
      await billingApi.createPlan({ code: planCode.trim(), name: planName.trim(), billingModel: planModel, basePrice: parseFloat(planPrice) });
      setPlanCode('');
      setPlanName('');
      setPlanPrice('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الخطة');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFeature() {
    if (!featureCode.trim() || !featureName.trim()) return;
    setBusy(true);
    try {
      await billingApi.createFeature({ code: featureCode.trim(), name: featureName.trim(), unit: featureUnit });
      setFeatureCode('');
      setFeatureName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الميزة');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetLimit() {
    if (!limitPlanCode || !limitFeatureCode) return;
    setBusy(true);
    try {
      await billingApi.setPlanFeatureLimit(limitPlanCode, {
        featureCode: limitFeatureCode,
        includedLimit: limitUnlimited ? undefined : limitValue ? parseInt(limitValue, 10) : undefined,
        overageUnitPrice: overagePrice ? parseFloat(overagePrice) : undefined,
      });
      setLimitValue('');
      setOveragePrice('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تحديد حد الميزة');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAddOn() {
    if (!addOnCode.trim() || !addOnName.trim() || !addOnPrice) return;
    setBusy(true);
    try {
      await billingApi.createAddOn({
        code: addOnCode.trim(),
        name: addOnName.trim(),
        price: parseFloat(addOnPrice),
        featureCode: addOnFeatureCode || undefined,
        extraLimitAmount: addOnExtraLimit ? parseFloat(addOnExtraLimit) : undefined,
      });
      setAddOnCode('');
      setAddOnName('');
      setAddOnPrice('');
      setAddOnFeatureCode('');
      setAddOnExtraLimit('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الإضافة');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold">إدارة الخطط والميزات</h1>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {/* ---- Existing plans ---- */}
      <div className="card mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-right">
            <tr>
              <th className="px-4 py-2">الرمز</th>
              <th className="px-4 py-2">الاسم</th>
              <th className="px-4 py-2">النموذج</th>
              <th className="px-4 py-2">السعر الأساسي</th>
              <th className="px-4 py-2">حدود الميزات</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 align-top">
                <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-slate-500">{BILLING_MODELS.find((m) => m.value === p.billingModel)?.label ?? p.billingModel}</td>
                <td className="px-4 py-2">
                  {p.basePrice.toLocaleString('ar')} {p.currency}
                </td>
                <td className="px-4 py-2">
                  {p.featureLimits && p.featureLimits.length > 0 ? (
                    <div className="space-y-0.5 text-xs text-slate-500">
                      {p.featureLimits.map((fl) => (
                        <div key={fl.feature.code}>
                          {fl.feature.name}: {fl.includedLimit === null ? 'غير محدود' : fl.includedLimit.toLocaleString('ar')}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">لا حدود مُحدَّدة بعد</span>
                  )}
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  لا توجد خطط بعد — أنشئ أول خطة أدناه
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ---- Create plan ---- */}
        <div className="card">
          <p className="mb-3 text-sm font-semibold text-slate-700">إنشاء خطة جديدة</p>
          <div className="space-y-2">
            <input className="input" placeholder="الرمز (مثال: professional)" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
            <input className="input" placeholder="اسم الخطة" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            <select className="input" value={planModel} onChange={(e) => setPlanModel(e.target.value)}>
              {BILLING_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input className="input" type="number" placeholder="السعر الأساسي (ر.س)" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} />
            <button onClick={handleCreatePlan} disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              إنشاء الخطة
            </button>
          </div>
        </div>

        {/* ---- Create feature ---- */}
        <div className="card">
          <p className="mb-3 text-sm font-semibold text-slate-700">إنشاء ميزة قابلة للقياس</p>
          <div className="space-y-2">
            <input className="input" placeholder="الرمز (مثال: monthly_ai_tokens)" value={featureCode} onChange={(e) => setFeatureCode(e.target.value)} />
            <input className="input" placeholder="اسم الميزة" value={featureName} onChange={(e) => setFeatureName(e.target.value)} />
            <select className="input" value={featureUnit} onChange={(e) => setFeatureUnit(e.target.value)}>
              {FEATURE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
            <button onClick={handleCreateFeature} disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              إنشاء الميزة
            </button>
          </div>
        </div>
      </div>

      {/* ---- Assign feature limit to plan ---- */}
      <div className="card mt-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">تحديد حد ميزة داخل خطة</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="input" value={limitPlanCode} onChange={(e) => setLimitPlanCode(e.target.value)}>
            <option value="">اختر الخطة</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input" value={limitFeatureCode} onChange={(e) => setLimitFeatureCode(e.target.value)}>
            <option value="">اختر الميزة</option>
            {features.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            placeholder="الحد المُضمَّن"
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            disabled={limitUnlimited}
          />
          <input className="input" type="number" placeholder="سعر تجاوز الحد (اختياري)" value={overagePrice} onChange={(e) => setOveragePrice(e.target.value)} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={limitUnlimited} onChange={(e) => setLimitUnlimited(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          غير محدود
        </label>
        <button
          onClick={handleSetLimit}
          disabled={busy || !limitPlanCode || !limitFeatureCode}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          حفظ الحد
        </button>
      </div>

      {/* ---- Add-ons catalog ---- */}
      <div className="card mt-6 overflow-x-auto p-0">
        <p className="px-4 pt-4 text-sm font-semibold text-slate-700">كتالوج الإضافات (Add-ons)</p>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-right">
            <tr>
              <th className="px-4 py-2">الرمز</th>
              <th className="px-4 py-2">الاسم</th>
              <th className="px-4 py-2">السعر</th>
              <th className="px-4 py-2">الميزة المرتبطة</th>
            </tr>
          </thead>
          <tbody>
            {addOns.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{a.code}</td>
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2">{a.price.toLocaleString('ar')} ر.س</td>
                <td className="px-4 py-2 text-slate-500">
                  {a.feature ? `${a.feature.name} (+${a.extraLimitAmount?.toLocaleString('ar')})` : '—'}
                </td>
              </tr>
            ))}
            {addOns.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  لا توجد إضافات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card mt-4 max-w-lg">
        <p className="mb-3 text-sm font-semibold text-slate-700">إنشاء إضافة جديدة</p>
        <div className="space-y-2">
          <input className="input" placeholder="الرمز (مثال: extra_storage_10gb)" value={addOnCode} onChange={(e) => setAddOnCode(e.target.value)} />
          <input className="input" placeholder="الاسم" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} />
          <input className="input" type="number" placeholder="السعر (ر.س)" value={addOnPrice} onChange={(e) => setAddOnPrice(e.target.value)} />
          <select className="input" value={addOnFeatureCode} onChange={(e) => setAddOnFeatureCode(e.target.value)}>
            <option value="">بلا ربط بميزة (اختياري)</option>
            {features.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
          {addOnFeatureCode && (
            <input
              className="input"
              type="number"
              placeholder="مقدار الزيادة في الحد"
              value={addOnExtraLimit}
              onChange={(e) => setAddOnExtraLimit(e.target.value)}
            />
          )}
          <button onClick={handleCreateAddOn} disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            إنشاء الإضافة
          </button>
        </div>
      </div>
    </div>
  );
}
