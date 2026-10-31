const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const SESSION_ROLE_KEY = 'lms_session_role';
let accessToken: string | null = null;
let refreshFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export function setSessionRole(role: string | null) {
  if (role) sessionStorage.setItem(SESSION_ROLE_KEY, role);
  else sessionStorage.removeItem(SESSION_ROLE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiQuery<T>(
  path: string,
  init: RequestInit = {},
  token = accessToken,
): Promise<{ data: T; meta?: { page: number; pageSize: number; total: number } }> {
  const send = (authToken: string | null) => {
    const headers = new Headers(init.headers);
    const sessionRole = sessionStorage.getItem(SESSION_ROLE_KEY);
    if (sessionRole) headers.set('X-LMS-Session-Role', sessionRole);
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  };
  let response = await send(token);
  if (response.status === 401 && token && !path.startsWith('/auth/')) {
    const sessionRole = sessionStorage.getItem(SESSION_ROLE_KEY);
    refreshFlight ??= fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: sessionRole ? { 'X-LMS-Session-Role': sessionRole } : undefined,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { accessToken?: string } };
        return body.data?.accessToken ?? null;
      })
      .catch(() => null)
      .finally(() => {
        refreshFlight = null;
      });
    const renewed = await refreshFlight;
    if (renewed) {
      setAccessToken(renewed);
      response = await send(renewed);
    }
  }
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    meta?: { page: number; pageSize: number; total: number };
    error?: { message?: string; code?: string; details?: unknown };
  };
  if (!response.ok)
    throw new ApiError(
      payload.error?.message ?? 'The request could not be completed.',
      response.status,
      payload.error?.code,
      payload.error?.details,
    );
  return { data: payload.data as T, meta: payload.meta };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token = accessToken,
): Promise<T> {
  return (await apiQuery<T>(path, init, token)).data;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export function uploadFile<T>(
  path: string,
  body: FormData,
  onProgress: (value: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () =>
      reject(new ApiError('Network error. Check your connection and try again.', 0));
    xhr.onload = () => {
      let payload: {
        data?: T;
        error?: { message?: string; code?: string };
      } = {};
      try {
        payload = JSON.parse(xhr.responseText || '{}') as typeof payload;
      } catch {
        reject(new ApiError('The server returned an invalid response.', xhr.status));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300)
        reject(
          new ApiError(payload.error?.message ?? 'Upload failed.', xhr.status, payload.error?.code),
        );
      else resolve(payload.data as T);
    };
    xhr.send(body);
  });
}
