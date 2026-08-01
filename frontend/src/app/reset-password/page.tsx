'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (newPassword.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword }, { skipAuth: true });
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر الاتصال بالخادم');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <p className="text-green-700">تم تحديث كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <label className="label" htmlFor="resetToken">رمز إعادة التعيين</label>
        <input
          id="resetToken"
          type="text"
          required
          className="input"
          value={resetToken}
          onChange={(e) => setResetToken(e.target.value)}
          placeholder="الرمز المُرسَل إلى بريدك"
        />
      </div>

      <div>
        <label className="label" htmlFor="newPassword">كلمة المرور الجديدة</label>
        <input
          id="newPassword"
          type="password"
          required
          className="input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">تأكيد كلمة المرور</label>
        <input
          id="confirmPassword"
          type="password"
          required
          className="input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'جارٍ الحفظ...' : 'تحديث كلمة المرور'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-700">تعيين كلمة مرور جديدة</h1>
        </div>
        <Suspense fallback={<div className="card text-center text-slate-500">جارٍ التحميل...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
