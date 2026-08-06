import { tokenStore } from './token-store';
import { translateError } from './error-translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions extends RequestInit {
  /** Skip attaching the Authorization header (login/refresh calls). */
  skipAuth?: boolean;
  /** Skip the automatic 401 -> refresh -> retry cycle (used by the refresh call itself). */
  skipRefreshRetry?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempts to exchange the stored refresh token for a new access token.
 * De-duplicated via `refreshInFlight` so concurrent 401s from multiple
 * simultaneous requests don't each trigger their own refresh call.
 */
async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      tokenStore.setAccessToken(data.accessToken);
      // Refresh tokens rotate server-side — persist the new one too.
      const user = tokenStore.getUser();
      if (user) tokenStore.setSession(data.accessToken, data.refreshToken, user);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Central fetch wrapper used by every API call in the app. This hits the
 * REAL backend (NEXT_PUBLIC_API_URL) — there is no mock data layer.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, skipRefreshRetry, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    const isFormData = rest.body instanceof FormData;
    if (!isFormData) finalHeaders['Content-Type'] = 'application/json';

    if (!skipAuth) {
      const token = tokenStore.getAccessToken();
      if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth && !skipRefreshRetry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      tokenStore.clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiError(401, 'انتهت صلاحية الجلسة', null);
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const rawMessage =
      (body && typeof body === 'object' && 'message' in body ? (body as any).message : null) ?? res.statusText;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    throw new ApiError(res.status, translateError(message), body);
  }

  return body as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, data?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
  patch: <T = unknown>(path: string, data?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = unknown>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
