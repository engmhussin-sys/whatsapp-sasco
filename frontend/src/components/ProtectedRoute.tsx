'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { SystemRole } from '@/lib/types';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: SystemRole[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.systemRole)) {
      router.replace('/');
    }
  }, [user, loading, allowedRoles, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">جارٍ التحقق من الجلسة...</p>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.systemRole)) {
    return null;
  }

  return <>{children}</>;
}
