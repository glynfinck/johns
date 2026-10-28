import { ApiError } from '@app/core';
import { Platform } from 'react-native';

import { getAccessToken } from './auth';

// Calls to apps/api, for the few moves that need a server (AGENTS.md lists
// them). Everything else goes straight to Supabase through RLS.

/** A refusal from the API, with a sentence fit to show. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Where apps/api answers. Unset on the web, it's the page's own origin:
 * jonz.app passes /api/* on to apps/api (apps/client/vercel.json), so
 * the browser needs no CORS. A phone has no origin, so there it must be set.
 */
export function apiBase(): string {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (base) return base;
  if (Platform.OS === 'web') return '';
  throw new Error('Missing EXPO_PUBLIC_API_URL. Copy .env.example to .env.local and fill it in.');
}

/**
 * POSTs to apps/api as the signed-in user (their Supabase access token as a
 * bearer token), and checks the answer against the response's schema from
 * @app/core.
 */
export async function apiPost<T>(path: string, body: unknown, schema: { parse: (value: unknown) => T }): Promise<T> {
  const base = apiBase();
  const token = await getAccessToken();
  if (!token) throw new ApiRequestError('Sign in first.', 401);

  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const refusal = ApiError.safeParse(payload);
    throw new ApiRequestError(refusal.success ? refusal.data.error : 'Something went wrong. Try again.', response.status);
  }
  return schema.parse(payload);
}
