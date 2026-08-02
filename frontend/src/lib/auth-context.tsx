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
  login: (email: string, password: string, companyId?: string) => Promise<void>;
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

  async function login(email: string, password: string, companyId?: string) {
    const result = await api.post<LoginResponse>(
      '/auth/login',
      { email, password, companyId },
      { skipAuth: true },
    );
    tokenStore.setSession(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);

    if (result.user.systemRole === 'SUPER_ADMIN') {
      router.push('/super-admin/dashboard');
    } else {
      router.push('/company-admin/dashboard');
    }
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

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
