'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { vehiclesApi, Vehicle } from '@/lib/api/assets';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function FleetPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [dueSoon, setDueSoon] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');

  function load() {
    if (!companyId) return;
    Promise.all([vehiclesApi.list(companyId), vehiclesApi.dueForMaintenance(companyId)])
      .then(([v, d]) => {
        setVehicles(v);
        setDueSoon(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الأسطول'));
  }

  useEffect(load, [companyId]);

  async function handleCreate() {
    try {
      await vehiclesApi.create(companyId, { plateNumber });
      setPlateNumber('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إضافة المركبة');
    }
  }

  if (error && !vehicles) return <ErrorBanner message={error} />;
  if (!vehicles) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إدارة الأسطول</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          + مركبة جديدة
        </button>
      </div>
      {error && <ErrorBanner message={error} />}

      {dueSoon.length > 0 && (
        <div className="rounded-dsCard border border-ds-warningBorder bg-ds-warningBg p-3 text-sm text-ds-warningText">
          {dueSoon.length} مركبة بحاجة صيانة خلال 7 أيام
        </div>
      )}

      {showForm && (
        <div className="flex items-end gap-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">رقم اللوحة</label>
            <input
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              dir="ltr"
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            />
          </div>
          <button onClick={handleCreate} disabled={!plateNumber} className="rounded-dsField bg-ds-text px-4 py-1.5 text-sm text-white disabled:opacity-50">
            حفظ
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {vehicles.map((v) => (
          <div key={v.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
            <p className="num text-sm font-semibold text-ds-text">{v.plateNumber}</p>
            <p className="mt-1 text-xs text-ds-textSecondary">
              {v.make} {v.model} {v.year}
            </p>
            {v.nextMaintenanceAt && (
              <p className="num mt-2 text-[11px] text-ds-textMuted">
                الصيانة القادمة: {new Date(v.nextMaintenanceAt).toLocaleDateString('en-CA')}
              </p>
            )}
          </div>
        ))}
        {vehicles.length === 0 && (
          <div className="col-span-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">
            لا توجد مركبات مُسجَّلة بعد
          </div>
        )}
      </div>
    </div>
  );
}
