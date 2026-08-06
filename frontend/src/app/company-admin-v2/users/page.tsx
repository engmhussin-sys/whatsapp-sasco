'use client';

import { useEffect, useState, FormEvent } from 'react';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyForm = { email: '', phone: '', password: '', firstName: '', lastName: '', systemRole: 'WORKER' };

export default function UsersV2Page() {
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

  const ROLE_LABELS: Record<string, string> = { WORKER: 'عامل', TEAM_LEAD: 'قائد فريق', COMPANY_ADMIN: 'مدير الشركة' };

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
            { label: 'كلمة المرور', key: 'password' as const, type: 'password', required: true },
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
            style={{ gridTemplateColumns: '1.5fr 1.3fr 1fr 1fr 90px' }}
          >
            <span>الاسم</span>
            <span>الهاتف</span>
            <span>الدور</span>
            <span>الحالة</span>
            <span></span>
          </div>
          {users.length === 0 ? (
            <p className="p-8 text-center text-sm text-ds-textSecondary">لا يوجد مستخدمون بعد</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
                style={{ gridTemplateColumns: '1.5fr 1.3fr 1fr 1fr 90px' }}
              >
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <span dir="ltr" className="num text-xs text-ds-textSecondary">{u.phone ?? u.email ?? '—'}</span>
                <span className="text-xs text-ds-textSecondary">{ROLE_LABELS[u.systemRole] ?? u.systemRole}</span>
                <span className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${u.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'}`}>
                  {u.isActive ? 'نشط' : 'معطّل'}
                </span>
                <button onClick={() => toggleActive(u)} className="w-fit text-xs font-medium text-ds-primary hover:underline">
                  {u.isActive ? 'تعطيل' : 'تفعيل'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
