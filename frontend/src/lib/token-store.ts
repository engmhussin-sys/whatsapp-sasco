import type { AuthUser } from './types';

const ACCESS_TOKEN_KEY = 'wfc_access_token';
const REFRESH_TOKEN_KEY = 'wfc_refresh_token';
const USER_KEY = 'wfc_user';

/**
 * Thin wrapper around localStorage. Kept as a standalone module (rather
 * than only living inside React state) so non-component code — like the
 * apiFetch() 401-retry logic — can read/write tokens without needing a
 * React context reference. All access is guarded for SSR (window undefined
 * during server render) since Next.js also renders on the server.
 */
export const tokenStore = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  setSession(accessToken: string, refreshToken: string, user: AuthUser) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setAccessToken(accessToken: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};
