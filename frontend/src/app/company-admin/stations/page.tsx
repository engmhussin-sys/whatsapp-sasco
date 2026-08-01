'use client';

import { useEffect, useState, FormEvent } from 'react';
import { stationsApi, Station } from '@/lib/api/stations';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyStationForm = { name: '', code: '' };
const emptyTankForm = { code: '', fuelType: '', capacityLiters: '' };

export default function StationsPage() {
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
    stationsApi
      .list(user.companyId)
      .then(setStations)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المحطات'));
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">المحطات</h1>
        <button onClick={() => setShowStationForm((s) => !s)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          {showStationForm ? 'إلغاء' : '+ محطة جديدة'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showStationForm && (
        <form onSubmit={handleCreateStation} className="card mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">اسم المحطة</label>
            <input required className="input" value={stationForm.name} onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">الكود</label>
            <input required className="input" value={stationForm.code} onChange={(e) => setStationForm({ ...stationForm, code: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={submittingStation} className="btn-primary">
              {submittingStation ? 'جارٍ الإنشاء...' : 'إنشاء المحطة'}
            </button>
          </div>
        </form>
      )}

      {!error && !stations && <Loading />}

      {stations && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stations.map((station) => (
            <div key={station.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{station.name}</p>
                  <p className="text-xs text-slate-400">{station.code}</p>
                </div>
                <button
                  onClick={() => setAddTankFor(addTankFor === station.id ? null : station.id)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  + إضافة خزان
                </button>
              </div>

              {addTankFor === station.id && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <input placeholder="الكود" className="input" value={tankForm.code} onChange={(e) => setTankForm({ ...tankForm, code: e.target.value })} />
                  <input placeholder="نوع الوقود" className="input" value={tankForm.fuelType} onChange={(e) => setTankForm({ ...tankForm, fuelType: e.target.value })} />
                  <input placeholder="السعة (لتر)" type="number" className="input" value={tankForm.capacityLiters} onChange={(e) => setTankForm({ ...tankForm, capacityLiters: e.target.value })} />
                  <button
                    onClick={() => handleAddTank(station.id)}
                    disabled={submittingTank}
                    className="col-span-3 rounded-lg bg-brand-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                  >
                    {submittingTank ? 'جارٍ الإضافة...' : 'إضافة الخزان'}
                  </button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {station.tanks.map((tank) => (
                  <div key={tank.id} className="rounded-lg border border-slate-100 p-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{tank.code} — {tank.fuelType}</span>
                      <span className="text-slate-500">
                        {tank.lastKnownLevel ?? '؟'} / {tank.capacityLiters} لتر
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${tank.lastKnownLevel ? Math.min(100, (tank.lastKnownLevel / tank.capacityLiters) * 100) : 0}%` }}
                      />
                    </div>
                    {editingLevelFor === tank.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          className="input"
                          placeholder="المستوى الجديد"
                          value={levelValue}
                          onChange={(e) => setLevelValue(e.target.value)}
                        />
                        <button onClick={() => handleUpdateLevel(tank.id)} className="rounded-lg bg-brand-600 px-3 py-1 text-xs text-white">
                          حفظ
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingLevelFor(tank.id)} className="mt-1 text-xs text-brand-600 hover:underline">
                        تحديث المستوى
                      </button>
                    )}
                  </div>
                ))}
                {station.tanks.length === 0 && <p className="text-xs text-slate-400">لا توجد خزانات بعد</p>}
              </div>
            </div>
          ))}
          {stations.length === 0 && <p className="text-sm text-slate-400">لا توجد محطات بعد</p>}
        </div>
      )}
    </div>
  );
}
