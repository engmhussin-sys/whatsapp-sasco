'use client';

import { useEffect, useState, FormEvent } from 'react';
import { stationsApi, Station } from '@/lib/api/stations';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyStationForm = { name: '', code: '' };
const emptyTankForm = { code: '', fuelType: '', capacityLiters: '' };

export default function StationsV2Page() {
  const { user } = useAuth();
  const [stations, setStations] = useState<Station[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showStationForm, setShowStationForm] = useState(false);
  const [stationForm, setStationForm] = useState(emptyStationForm);
  const [submittingStation, setSubmittingStation] = useState(false);

  const [addTankFor, setAddTankFor] = useState<string | null>(null);
  const [tankForm, setTankForm] = useState(emptyTankForm);
  const [submittingTank, setSubmittingTank] = useState(false);

  const [editingLevelFor, setEditingLevelFor] = useState<string | null>(null);
  const [levelValue, setLevelValue] = useState('');

  function load() {
    if (!user?.companyId) return;
    stationsApi.list(user.companyId).then(setStations).catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المحطات'));
  }

  useEffect(load, [user]);

  async function handleCreateStation(e: FormEvent) {
    e.preventDefault();
    if (!user?.companyId) return;
    setSubmittingStation(true);
    try {
      await stationsApi.create(user.companyId, stationForm);
      setStationForm(emptyStationForm);
      setShowStationForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء المحطة');
    } finally {
      setSubmittingStation(false);
    }
  }

  async function handleAddTank(stationId: string) {
    if (!user?.companyId) return;
    const capacityLiters = parseFloat(tankForm.capacityLiters);
    if (!tankForm.code || !tankForm.fuelType || isNaN(capacityLiters)) return;
    setSubmittingTank(true);
    try {
      await stationsApi.addTank(user.companyId, stationId, { code: tankForm.code, fuelType: tankForm.fuelType, capacityLiters });
      setTankForm(emptyTankForm);
      setAddTankFor(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إضافة الخزان');
    } finally {
      setSubmittingTank(false);
    }
  }

  async function handleUpdateLevel(tankId: string) {
    if (!user?.companyId) return;
    const level = parseFloat(levelValue);
    if (isNaN(level)) return;
    try {
      await stationsApi.updateTankLevel(user.companyId, tankId, level);
      setEditingLevelFor(null);
      setLevelValue('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تحديث المستوى');
    }
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">المحطات</h1>
        <button
          onClick={() => setShowStationForm((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          {showStationForm ? 'إلغاء' : '+ محطة جديدة'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showStationForm && (
        <form onSubmit={handleCreateStation} className="grid grid-cols-1 gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">اسم المحطة</label>
            <input required value={stationForm.name} onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">الكود</label>
            <input required value={stationForm.code} onChange={(e) => setStationForm({ ...stationForm, code: e.target.value })} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={submittingStation} className="rounded-dsField bg-ds-text px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
              {submittingStation ? 'جارٍ الإنشاء...' : 'إنشاء المحطة'}
            </button>
          </div>
        </form>
      )}

      {!error && !stations && <Loading />}

      {stations && (
        <div className="grid grid-cols-2 gap-[14px]">
          {stations.length === 0 ? (
            <p className="col-span-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">لا توجد محطات بعد</p>
          ) : (
            stations.map((station) => (
              <div key={station.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ds-text">{station.name}</p>
                    <p className="text-xs text-ds-textDisabled">{station.code}</p>
                  </div>
                  <button onClick={() => setAddTankFor(addTankFor === station.id ? null : station.id)} className="text-xs font-medium text-ds-primary hover:underline">
                    + إضافة خزان
                  </button>
                </div>

                {addTankFor === station.id && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <input placeholder="الكود" value={tankForm.code} onChange={(e) => setTankForm({ ...tankForm, code: e.target.value })} className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-xs" />
                    <input placeholder="نوع الوقود" value={tankForm.fuelType} onChange={(e) => setTankForm({ ...tankForm, fuelType: e.target.value })} className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-xs" />
                    <input placeholder="السعة (لتر)" type="number" value={tankForm.capacityLiters} onChange={(e) => setTankForm({ ...tankForm, capacityLiters: e.target.value })} className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-xs" />
                    <button
                      onClick={() => handleAddTank(station.id)}
                      disabled={submittingTank}
                      className="col-span-3 rounded-dsField bg-ds-primary px-3 py-2 text-xs text-white disabled:opacity-50"
                    >
                      {submittingTank ? 'جارٍ الإضافة...' : 'إضافة الخزان'}
                    </button>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  {station.tanks.map((tank) => (
                    <div key={tank.id} className="rounded-dsCardInner border border-ds-cardBorder p-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ds-text">{tank.code} — {tank.fuelType}</span>
                        <span className="num text-ds-textSecondary">{tank.lastKnownLevel ?? '؟'} / {tank.capacityLiters} لتر</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-dsPill bg-ds-trackBg">
                        <div
                          className="h-full rounded-dsPill bg-ds-primary transition-all duration-500 ease-out"
                          style={{ width: `${tank.lastKnownLevel ? Math.min(100, (tank.lastKnownLevel / tank.capacityLiters) * 100) : 0}%` }}
                        />
                      </div>
                      {editingLevelFor === tank.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            placeholder="المستوى الجديد"
                            value={levelValue}
                            onChange={(e) => setLevelValue(e.target.value)}
                            className="flex-1 rounded-dsField border border-ds-fieldBorder px-2 py-1 text-xs"
                          />
                          <button onClick={() => handleUpdateLevel(tank.id)} className="rounded-dsField bg-ds-primary px-3 py-1 text-xs text-white">
                            حفظ
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingLevelFor(tank.id)} className="mt-1 text-xs font-medium text-ds-primary hover:underline">
                          تحديث المستوى
                        </button>
                      )}
                    </div>
                  ))}
                  {station.tanks.length === 0 && <p className="text-xs text-ds-textDisabled">لا توجد خزانات بعد</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
