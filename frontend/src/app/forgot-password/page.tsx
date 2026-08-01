'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post<{ message: string }>('/auth/forgot-password', { email }, { skipAuth: true });
      setResult({ ok: true, message: res.message });
    } catch (err) {
      setResult({ ok: false, message: err instanceof ApiError ? err.message : 'تعذّر الاتصال بالخادم' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-700">استعادة كلمة المرور</h1>
          <p className="mt-1 text-sm text-slate-500">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {result && (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {result.message}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>

          <div className="text-center text-sm">
            <Link href="/login" className="text-brand-600 hover:underline">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
