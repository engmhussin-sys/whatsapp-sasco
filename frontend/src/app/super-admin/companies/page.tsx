'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import type { Company } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const emptyForm = {
  name: '',
  slug: '',
  industry: '',
  adminEmail: '',
  adminPassword: '',
  adminFirstName: '',
  adminLastName: '',
};

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    companiesApi
      .listAll()
      .then((res) => setCompanies(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الشركات'));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await companiesApi.create(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الشركة');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">الشركات</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          {showForm ? 'إلغاء' : '+ شركة جديدة'}
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
          <Field label="اسم الشركة" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="المعرّف (slug)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} required />
          <Field label="القطاع" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
          <div />
          <Field label="بريد مدير الشركة" type="email" value={form.adminEmail} onChange={(v) => setForm({ ...form, adminEmail: v })} required />
          <Field label="كلمة مرور مدير الشركة" type="password" value={form.adminPassword} onChange={(v) => setForm({ ...form, adminPassword: v })} required />
          <Field label="الاسم الأول للمدير" value={form.adminFirstName} onChange={(v) => setForm({ ...form, adminFirstName: v })} required />
          <Field label="اسم عائلة المدير" value={form.adminLastName} onChange={(v) => setForm({ ...form, adminLastName: v })} required />
          <div className="md:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'جارٍ الإنشاء...' : 'إنشاء الشركة'}
            </button>
          </div>
        </form>
      )}

      {!error && !companies && <Loading />}

      {companies && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-right">
              <tr>
                <th className="px-4 py-2">الاسم</th>
                <th className="px-4 py-2">المعرّف</th>
                <th className="px-4 py-2">الخطة</th>
                <th className="px-4 py-2">الحالة</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/super-admin/companies/${c.id}`)}
                  className="cursor-pointer border-b border-ink-100 transition hover:bg-brand-50/40"
                >
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-ink-500">{c.slug}</td>
                  <td className="px-4 py-2">{c.subscription?.plan ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={c.isActive ? 'text-brand-600' : 'text-red-600'}>{c.isActive ? 'نشطة' : 'معطّلة'}</span>
                  </td>
                  <td className="px-4 py-2 text-left text-ink-300">إدارة الفوترة ←</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-400">
                    لا توجد شركات بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} required={required} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
