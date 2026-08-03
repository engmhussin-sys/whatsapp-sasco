'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth, ApiError } from '@/lib/auth-context';
import { testAccountsApi, type TestAccount } from '@/lib/api/test-accounts';

export default function LoginPage() {
  const { login, testLogin } = useAuth();
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- Testing-phase quick-login panel -------------------------------------
  // Only populated when the backend has ENABLE_TEST_ACCOUNTS=true set — see
  // AuthService.assertTestAccountsEnabled(). Silently empty otherwise, so
  // this whole section simply doesn't render outside the testing period.
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [testLoginBusyId, setTestLoginBusyId] = useState<string | null>(null);

  useEffect(() => {
    testAccountsApi.list().then(setTestAccounts);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginMode === 'email' ? { email } : { phone }, password, companyId || undefined);
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

  async function handleTestLogin(accountId: string) {
    setError(null);
    setTestLoginBusyId(accountId);
    try {
      await testLogin(accountId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر الدخول بهذا الحساب');
    } finally {
      setTestLoginBusyId(null);
    }
  }

  // Group test accounts by company for a clearer picker.
  const groupedTestAccounts = testAccounts.reduce<Record<string, TestAccount[]>>((acc, a) => {
    const key = a.companyName ?? 'منصة (Super Admin)';
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl shadow-card">⛽</div>
          <h1 className="text-xl font-extrabold text-ink-900">ساسكو</h1>
          <p className="mt-1 text-sm text-ink-500">منصة تواصل وتشغيل فرق العمل</p>
        </div>

        {/* ---- Quick test login — only visible when backend enables it ---- */}
        {testAccounts.length > 0 && (
          <div className="card mb-4 border-amber-200 bg-amber-50/50">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">فترة اختبار</span>
              <p className="text-xs font-semibold text-amber-800">دخول سريع بدون كلمة مرور</p>
            </div>
            <div className="space-y-3">
              {Object.entries(groupedTestAccounts).map(([companyName, accounts]) => (
                <div key={companyName}>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">{companyName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleTestLogin(a.id)}
                        disabled={testLoginBusyId !== null}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        {testLoginBusyId === a.id ? '...جارٍ الدخول' : `${a.role} — ${a.email.split('@')[0]}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {/* ---- Email / Phone toggle ---- */}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setLoginMode('email')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${loginMode === 'email' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              البريد الإلكتروني
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('phone')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${loginMode === 'phone' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              رقم الهاتف
            </button>
          </div>

          {loginMode === 'email' ? (
            <div>
              <label className="label" htmlFor="email">
                البريد الإلكتروني
              </label>
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
          ) : (
            <div>
              <label className="label" htmlFor="phone">
                رقم الهاتف
              </label>
              <input
                id="phone"
                type="tel"
                required
                dir="ltr"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966500000000"
              />
              <p className="mt-1 text-xs text-slate-400">مناسب لعمال المحطات الذين لا يملكون بريدًا إلكترونيًا</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="password">
              كلمة المرور
            </label>
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
              معرّف الشركة <span className="text-slate-400">(اختياري — فقط إذا كان بريدك/هاتفك مستخدَمًا في أكثر من شركة)</span>
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
