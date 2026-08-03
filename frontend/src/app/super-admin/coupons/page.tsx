'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type Coupon } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    billingApi
      .listCoupons()
      .then(setCoupons)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الكوبونات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!code.trim() || !discountValue) return;
    setBusy(true);
    try {
      await billingApi.createCoupon({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: parseFloat(discountValue),
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : undefined,
        validUntil: validUntil || undefined,
      });
      setCode('');
      setDiscountValue('');
      setMaxRedemptions('');
      setValidUntil('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الكوبون');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold">الكوبونات والخصومات</h1>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="card mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-right">
            <tr>
              <th className="px-4 py-2">الرمز</th>
              <th className="px-4 py-2">الخصم</th>
              <th className="px-4 py-2">الاستخدام</th>
              <th className="px-4 py-2">ينتهي في</th>
              <th className="px-4 py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-mono text-xs font-semibold">{c.code}</td>
                <td className="px-4 py-2">{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `${c.discountValue.toLocaleString('ar')} ر.س`}</td>
                <td className="px-4 py-2 text-slate-500">
                  {c.redeemedCount.toLocaleString('ar')} {c.maxRedemptions !== null && `/ ${c.maxRedemptions.toLocaleString('ar')}`}
                </td>
                <td className="px-4 py-2 text-slate-500">{c.validUntil ? new Date(c.validUntil).toLocaleDateString('ar') : 'بلا انتهاء'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.isActive ? 'نشط' : 'موقوف'}
                  </span>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  لا توجد كوبونات بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card max-w-lg">
        <p className="mb-3 text-sm font-semibold text-slate-700">إنشاء كوبون جديد</p>
        <div className="space-y-2">
          <input className="input" placeholder="رمز الكوبون (مثال: WELCOME20)" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}>
              <option value="PERCENTAGE">نسبة مئوية %</option>
              <option value="FIXED_AMOUNT">مبلغ ثابت</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder={discountType === 'PERCENTAGE' ? 'مثال: 20' : 'مثال: 100'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <input
            className="input"
            type="number"
            placeholder="الحد الأقصى للاستخدام (اختياري)"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-xs text-slate-500">تاريخ الانتهاء (اختياري)</label>
            <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <button onClick={handleCreate} disabled={busy} className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            إنشاء الكوبون
          </button>
        </div>
      </div>
    </div>
  );
}
