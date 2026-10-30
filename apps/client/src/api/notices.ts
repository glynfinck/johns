import { NoticesResponse, pruneClosed, type ClosedNotices, type Notice } from '@app/core';

import { apiBase } from './base';
import { authStorage } from './storage';

// The notices at the top of the app (packages/core/src/notices.ts). Anyone
// may read them, signed in or not, so the call carries no token. The last
// answer is kept on the device, so a notice still shows when nothing can be
// reached; so is when this device closed each one.

const LAST_KEY = 'jonz.notices';
const CLOSED_KEY = 'jonz.closed-notices';

/** GET /api/notices. Throws when the API can't be reached or answers with an error. */
export async function fetchNotices(): Promise<Notice[]> {
  const response = await fetch(`${apiBase()}/api/notices`);
  if (!response.ok) throw new Error(`notices ${response.status}`);
  const { notices } = NoticesResponse.parse(await response.json());
  remember(LAST_KEY, notices);
  return notices;
}

/** The notices this device last saw, for while nothing can be reached. */
export function lastNotices(): Notice[] {
  const saved = NoticesResponse.shape.notices.safeParse(recall(LAST_KEY));
  return saved.success ? saved.data : [];
}

export function closedNotices(): ClosedNotices {
  const saved = recall(CLOSED_KEY);
  return saved !== null && typeof saved === 'object' ? (saved as ClosedNotices) : {};
}

/** Closes a notice on this device, forgetting closed notices that are no longer sent. */
export function closeNotice(id: string, notices: readonly Notice[], now: Date): ClosedNotices {
  const closed = {
    ...pruneClosed(closedNotices(), notices),
    [id]: now.toISOString(),
  };
  remember(CLOSED_KEY, closed);
  return closed;
}

function recall(key: string): unknown {
  try {
    const raw = authStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function remember(key: string, value: unknown) {
  try {
    authStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept (private browsing, say); the banner still works until the app closes.
  }
}
