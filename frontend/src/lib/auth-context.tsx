'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from './api-client';
import { tokenStore } from './token-store';
import { chatSocket } from './websocket-client';
import type { AuthUser, LoginResponse } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: { email?: string; phone?: string }, password: string, companyId?: string) => Promise<void>;
  /** Testing-phase only — issues real tokens for a seeded account with one click, no password. Backend rejects this entirely unless ENABLE_TEST_ACCOUNTS=true is set there. */
  testLogin: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Hydrate from localStorage on first client-side mount.
    setUser(tokenStore.getUser());
    setLoading(false);
  }, []);

  function applySession(result: LoginResponse) {
    tokenStore.setSession(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);

    if (result.user.systemRole === 'SUPER_ADMIN') {
      router.push('/super-admin/dashboard');
    } else {
      router.push('/company-admin/dashboard');
    }
  }

  async function login(identifier: { email?: string; phone?: string }, password: string, companyId?: string) {
    const result = await api.post<LoginResponse>(
      '/auth/login',
      { ...identifier, password, companyId },
      { skipAuth: true },
    );
    applySession(result);
  }

  async function testLogin(userId: string) {
    const result = await api.post<LoginResponse>(`/auth/test-accounts/${userId}/login`, {}, { skipAuth: true });
    applySession(result);
  }

  async function logout() {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }, { skipAuth: true, skipRefreshRetry: true });
      }
    } catch {
      // Best-effort — proceed with local logout regardless of server response.
    }
    tokenStore.clear();
    chatSocket.disconnect();
    setUser(null);
    router.push('/login');
  }

  return <AuthContext.Provider value={{ user, loading, login, testLogin, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
