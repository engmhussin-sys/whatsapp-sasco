'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type Coupon } from '@/lib/api/billing';
import { ApiError } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function CouponsV2Page() {
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
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الكوبونات والخصومات</h1>
      {error && <ErrorBanner message={error} />}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 90px' }}>
          <span>الرمز</span>
          <span>الخصم</span>
          <span>الاستخدام</span>
          <span>ينتهي في</span>
          <span>الحالة</span>
        </div>
        {coupons.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد كوبونات بعد</p>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm last:border-0" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 90px' }}>
              <span className="num font-mono text-xs font-semibold text-ds-text">{c.code}</span>
              <span className="num text-ds-textSecondary">{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `${c.discountValue.toLocaleString('en')} ر.س`}</span>
              <span className="num text-ds-textSecondary">{c.redeemedCount.toLocaleString('en')}{c.maxRedemptions !== null && ` / ${c.maxRedemptions.toLocaleString('en')}`}</span>
              <span className="num text-ds-textSecondary">{c.validUntil ? new Date(c.validUntil).toLocaleDateString('en-CA') : 'بلا انتهاء'}</span>
              <span className={`w-fit rounded-dsPill px-2.5 py-0.5 text-xs font-semibold ${c.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-trackBg text-ds-textMuted'}`}>
                {c.isActive ? 'نشط' : 'موقوف'}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="max-w-lg rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <p className="mb-3 text-sm font-semibold text-ds-text">إنشاء كوبون جديد</p>
        <div className="flex flex-col gap-2">
          <input
            placeholder="رمز الكوبون (مثال: WELCOME20)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')} className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
              <option value="PERCENTAGE">نسبة مئوية %</option>
              <option value="FIXED_AMOUNT">مبلغ ثابت</option>
            </select>
            <input
              type="number"
              placeholder={discountType === 'PERCENTAGE' ? 'مثال: 20' : 'مثال: 100'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm"
            />
          </div>
          <input
            type="number"
            placeholder="الحد الأقصى للاستخدام (اختياري)"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm"
          />
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">تاريخ الانتهاء (اختياري)</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
          </div>
          <button onClick={handleCreate} disabled={busy} className="w-full rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50">
            إنشاء الكوبون
          </button>
        </div>
      </div>
    </div>
  );
}
