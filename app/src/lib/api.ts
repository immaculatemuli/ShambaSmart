import { Platform } from 'react-native';
import { currentLanguage, t } from './i18n';

/**
 * Where the ShambaSmart backend lives: EXPO_PUBLIC_API_URL (set in eas.json for the installable app, or in app/.env
 * for `expo start`, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 for a backend on the laptop).
 * The web app is served by the backend itself, so with no address set it talks to the address it was loaded from.
 */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

export const getApiUrl = () => apiUrl;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: () => void = () => {};

export function configureAuth(token: string | null, handler?: () => void) {
  authToken = token;
  if (handler) onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// The free server falls asleep when nobody uses it and takes up to a minute to wake. After a quiet spell, knock on
// /health (safe to repeat) until it answers before sending the real request, so that one is never lost or sent twice.
const QUIET_MS = 10 * 60_000;
const WAKE_FOR_MS = 75_000;
let lastHeard = 0;
let waking: Promise<void> | null = null;

async function wakeServer() {
  const until = Date.now() + WAKE_FOR_MS;
  while (Date.now() < until) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      if ((await fetch(`${apiUrl}/health`, { signal: controller.signal })).ok) {
        lastHeard = Date.now();
        return;
      }
    } catch {
      // Still asleep (or no internet): try again shortly.
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/** `timeoutMs`: how long to wait for the server (longer for a photo check on a slow network). */
export async function api<T>(path: string, options: { method?: Method; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  if (!apiUrl && Platform.OS !== 'web') {
    throw new ApiError(0, 'NO_SERVER', t('The app has no server address. Set EXPO_PUBLIC_API_URL and restart.'));
  }
  if (Date.now() - lastHeard > QUIET_MS) {
    waking ??= wakeServer().finally(() => {
      waking = null;
    });
    await waking;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'X-Language': currentLanguage(),
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', t('Could not reach ShambaSmart. Check your internet connection and try again.'));
  } finally {
    clearTimeout(timer);
  }
  lastHeard = Date.now();
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized();
    const error = data?.error;
    throw new ApiError(res.status, error?.code ?? 'ERROR', t(error?.message ?? 'Something went wrong. Please try again'), error?.details);
  }
  return data as T;
}

/** The message to show for any error from `api` (validation errors name the first field that is wrong). */
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const first = error.details?.[0];
    return first ? `${t(error.message)}: ${first.field ? `${first.field} – ` : ''}${first.message}` : error.message;
  }
  return t('Something went wrong. Please try again');
}
