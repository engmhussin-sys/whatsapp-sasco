'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { trainingApi, Certification } from '@/lib/api/visitors-training-compliance';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const STATUS_LABELS: Record<string, string> = { VALID: 'سارية', EXPIRING_SOON: 'تنتهي قريبًا', EXPIRED: 'منتهية', NO_EXPIRY: 'بلا انتهاء' };
const STATUS_COLORS: Record<string, string> = {
  VALID: 'bg-ds-successBg text-ds-successText',
  EXPIRING_SOON: 'bg-ds-warningBg text-ds-warningText',
  EXPIRED: 'bg-ds-dangerBg text-ds-dangerText',
  NO_EXPIRY: 'bg-ds-trackBg text-ds-textMuted',
};

export default function TrainingPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [certs, setCerts] = useState<Certification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    trainingApi.listAll(companyId).then(setCerts).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الشهادات'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!certs) return <Loading />;

  const expiringCount = certs.filter((c) => c.computedStatus === 'EXPIRING_SOON' || c.computedStatus === 'EXPIRED').length;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">التدريب والشهادات</h1>

      {expiringCount > 0 && (
        <div className="rounded-dsCard border border-ds-warningBorder bg-ds-warningBg p-3 text-sm text-ds-warningText">
          {expiringCount} شهادة تحتاج تجديدًا
        </div>
      )}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted" style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr' }}>
          <span>الموظف</span>
          <span>الشهادة</span>
          <span>تنتهي في</span>
          <span>الحالة</span>
        </div>
        {certs.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد شهادات مُسجَّلة بعد</p>
        ) : (
          certs.map((c) => (
            <div key={c.id} className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0" style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr' }}>
              <span className="font-medium">{c.user ? `${c.user.firstName} ${c.user.lastName}` : '—'}</span>
              <span className="text-xs text-ds-textSecondary">{c.name}</span>
              <span className="num text-xs text-ds-textMuted">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-CA') : '—'}</span>
              <span className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${STATUS_COLORS[c.computedStatus]}`}>{STATUS_LABELS[c.computedStatus]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
