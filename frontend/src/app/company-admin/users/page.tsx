'use client';

import { useEffect, useState, FormEvent } from 'react';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyForm = { email: '', phone: '', password: '', firstName: '', lastName: '', systemRole: 'WORKER' };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    if (!user?.companyId) return;
    usersApi
      .list(user.companyId)
      .then((res) => setUsers(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المستخدمين'));
  }

  useEffect(load, [user]);

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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">المستخدمون</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          {showForm ? 'إلغاء' : '+ مستخدم جديد'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {formError && (
            <div className="md:col-span-2">
              <ErrorBanner message={formError} />
            </div>
          )}
          <div className="md:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            رقم الهاتف هو وسيلة التسجيل الأساسية (يُستخدَم لتسجيل الدخول على تطبيق الموبايل) — البريد الإلكتروني اختياري إضافي. أدخل أحدهما على الأقل.
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input type="tel" className="input" placeholder="+9665XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">البريد الإلكتروني (اختياري)</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input type="password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">الاسم الأول</label>
            <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">اسم العائلة</label>
            <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">الدور</label>
            <select className="input" value={form.systemRole} onChange={(e) => setForm({ ...form, systemRole: e.target.value })}>
              <option value="WORKER">عامل (Worker)</option>
              <option value="TEAM_LEAD">قائد فريق (Team Lead)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
            </button>
          </div>
        </form>
      )}

      {!error && !users && <Loading />}

      {users && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-right">
              <tr>
                <th className="px-4 py-2">الاسم</th>
                <th className="px-4 py-2">الهاتف</th>
                <th className="px-4 py-2">الدور</th>
                <th className="px-4 py-2">الحالة</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-2 text-slate-500">{u.phone ?? u.email ?? '—'}</td>
                  <td className="px-4 py-2">{u.systemRole}</td>
                  <td className="px-4 py-2">
                    <span className={u.isActive ? 'text-green-600' : 'text-red-600'}>{u.isActive ? 'نشط' : 'معطّل'}</span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleActive(u)} className="text-xs text-brand-600 hover:underline">
                      {u.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">لا يوجد مستخدمون بعد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
