'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth, ApiError } from '@/lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, companyId || undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'فشل تسجيل الدخول');
      } else {
        setError('تعذّر الاتصال بالخادم. تأكد من تشغيل الـ Backend.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-700">WorkForce Connect AI</h1>
          <p className="mt-1 text-sm text-slate-500">تسجيل الدخول إلى حسابك</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
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

          <div>
            <label className="label" htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="label" htmlFor="companyId">
              معرّف الشركة <span className="text-slate-400">(اختياري — فقط إذا كان بريدك مستخدَمًا في أكثر من شركة)</span>
            </label>
            <input
              id="companyId"
              type="text"
              className="input"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="company UUID"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>

          <div className="text-center text-sm">
            <Link href="/forgot-password" className="text-brand-600 hover:underline">
              نسيت كلمة المرور؟
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
