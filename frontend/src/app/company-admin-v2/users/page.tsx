'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import { usersApi } from '@/lib/api/users';
import { stationsApi, Station } from '@/lib/api/stations';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyForm = { email: '', phone: '', password: '', firstName: '', lastName: '', systemRole: 'WORKER', primaryStationId: '' };
const ROLE_LABELS: Record<string, string> = { WORKER: 'عامل', TEAM_LEAD: 'قائد فريق', COMPANY_ADMIN: 'مدير الشركة' };

export default function UsersV2Page() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [stationFilter, setStationFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', systemRole: 'WORKER', primaryStationId: '', newPassword: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.companyId) return;
    usersApi
      .list(user.companyId, { search: search || undefined, stationId: stationFilter || undefined })
      .then((res) => setUsers(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المستخدمين'));
  }, [user, search, stationFilter]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!user?.companyId) return;
    stationsApi.list(user.companyId).then(setStations).catch(() => {});
  }, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user?.companyId) return;
    setFormError(null);
    if (!form.email.trim() && !form.phone.trim()) {
      setFormError('أدخل البريد الإلكتروني أو رقم الهاتف — أحدهما على الأقل مطلوب');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.create(user.companyId, {
        ...form,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password.trim() || undefined,
        primaryStationId: form.primaryStationId || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'تعذّر إنشاء المستخدم');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u: AppUser) {
    if (!user?.companyId) return;
    await usersApi.update(user.companyId, u.id, { isActive: !u.isActive });
    load();
  }

  function startEdit(u: AppUser) {
    setEditingId(u.id);
    setEditError(null);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      systemRole: u.systemRole,
      primaryStationId: u.primaryStationId ?? '',
      newPassword: '',
    });
  }

  async function saveEdit(userId: string) {
    if (!user?.companyId) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await usersApi.update(user.companyId, userId, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        systemRole: editForm.systemRole,
        primaryStationId: editForm.primaryStationId || null,
        ...(editForm.newPassword.trim() ? { password: editForm.newPassword.trim() } : {}),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'تعذّر حفظ التعديلات');
    } finally {
      setEditSubmitting(false);
    }
  }

  const stationName = (id?: string | null) => stations.find((s) => s.id === id)?.name;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">المستخدمون</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          {showForm ? 'إلغاء' : '+ مستخدم جديد'}
        </button>
      </div>
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="ابحث بالاسم أو الهاتف أو البريد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] flex-1 rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm focus:border-ds-primary focus:outline-none"
        />
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm"
        >
          <option value="">كل مناطق العمل (الشركة كاملة)</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5 md:grid-cols-2">
          {formError && (
            <div className="md:col-span-2">
              <ErrorBanner message={formError} />
            </div>
          )}
          <div className="rounded-dsCardInner bg-ds-primaryLight px-3 py-2 text-xs text-ds-primaryDarker md:col-span-2">
            رقم الهاتف هو وسيلة التسجيل الأساسية (يُستخدَم لتسجيل الدخول على تطبيق الموبايل) — البريد الإلكتروني اختياري إضافي.
          </div>
          {[
            { label: 'رقم الهاتف', key: 'phone' as const, type: 'tel', placeholder: '+9665XXXXXXXX' },
            { label: 'البريد الإلكتروني (اختياري)', key: 'email' as const, type: 'email' },
            { label: 'كلمة المرور (اختياري — يُنشئها العامل بنفسه إن تُركت فارغة)', key: 'password' as const, type: 'password' },
            { label: 'الاسم الأول', key: 'firstName' as const, type: 'text', required: true },
            { label: 'اسم العائلة', key: 'lastName' as const, type: 'text', required: true },
          ].map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-ds-textMuted">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">الدور</label>
            <select
              value={form.systemRole}
              onChange={(e) => setForm({ ...form, systemRole: e.target.value })}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            >
              <option value="WORKER">عامل (Worker)</option>
              <option value="TEAM_LEAD">قائد فريق (Team Lead)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">منطقة العمل / المحطة (اختياري)</label>
            <select
              value={form.primaryStationId}
              onChange={(e) => setForm({ ...form, primaryStationId: e.target.value })}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            >
              <option value="">بلا تعيين — على مستوى الشركة</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-dsField bg-ds-text px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
            </button>
          </div>
        </form>
      )}

      {!error && !users && <Loading />}

      {users && (
        <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
          <div
            className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
            style={{ gridTemplateColumns: '1.3fr 1.1fr 0.9fr 1fr 0.8fr 140px' }}
          >
            <span>الاسم</span>
            <span>الهاتف</span>
            <span>الدور</span>
            <span>منطقة العمل</span>
            <span>الحالة</span>
            <span></span>
          </div>
          {users.length === 0 ? (
            <p className="p-8 text-center text-sm text-ds-textSecondary">لا يوجد مستخدمون مطابقون</p>
          ) : (
            users.map((u) =>
              editingId === u.id ? (
                <div key={u.id} className="border-b border-ds-rowDivider bg-ds-primaryLight/40 p-4 last:border-0">
                  {editError && <div className="mb-2"><ErrorBanner message={editError} /></div>}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      placeholder="الاسم الأول"
                      className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-sm"
                    />
                    <input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      placeholder="اسم العائلة"
                      className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-sm"
                    />
                    <select
                      value={editForm.systemRole}
                      onChange={(e) => setEditForm({ ...editForm, systemRole: e.target.value })}
                      className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-sm"
                    >
                      <option value="WORKER">عامل</option>
                      <option value="TEAM_LEAD">قائد فريق</option>
                      <option value="COMPANY_ADMIN">مدير الشركة</option>
                    </select>
                    <select
                      value={editForm.primaryStationId}
                      onChange={(e) => setEditForm({ ...editForm, primaryStationId: e.target.value })}
                      className="rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-sm"
                    >
                      <option value="">بلا تعيين محطة</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                      placeholder="كلمة مرور جديدة (اتركها فارغة إن لم ترد تغييرها)"
                      className="min-w-[260px] flex-1 rounded-dsField border border-ds-fieldBorder px-2 py-1.5 text-sm"
                    />
                    <button onClick={() => saveEdit(u.id)} disabled={editSubmitting} className="rounded-dsField bg-ds-primary px-4 py-1.5 text-xs text-white disabled:opacity-50">
                      {editSubmitting ? 'جارٍ الحفظ...' : 'حفظ'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded-dsField border border-ds-fieldBorder px-4 py-1.5 text-xs text-ds-textSecondary">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={u.id}
                  className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
                  style={{ gridTemplateColumns: '1.3fr 1.1fr 0.9fr 1fr 0.8fr 140px' }}
                >
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  <span dir="ltr" className="num text-xs text-ds-textSecondary">{u.phone ?? u.email ?? '—'}</span>
                  <span className="text-xs text-ds-textSecondary">{ROLE_LABELS[u.systemRole] ?? u.systemRole}</span>
                  <span className="text-xs text-ds-textSecondary">{stationName(u.primaryStationId) ?? '—'}</span>
                  <span className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${u.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'}`}>
                    {u.isActive ? 'نشط' : 'معطّل'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(u)} className="text-xs font-medium text-ds-primary hover:underline">تعديل</button>
                    <button onClick={() => toggleActive(u)} className="text-xs font-medium text-ds-textSecondary hover:underline">
                      {u.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
