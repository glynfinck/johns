import { ResetResponse, type ResetPreview, type ResetRequest } from '@app/core';

import { apiPost } from './http';

// An admin's resets go through the server (POST /api/resets,
// apps/api/lib/moves/resets.ts), which works out the house's forfeits and
// tells everyone a reset touches. The same call says what one would change.

/** A reset, without `apply`: what it would change. */
export type ResetAsk = Omit<ResetRequest, 'apply'>;

/** What a reset would change, for the reset sheet. Nothing changes yet. */
export async function previewReset(ask: ResetAsk): Promise<ResetPreview> {
  const { preview } = await apiPost('/api/resets', { ...ask, apply: false }, ResetResponse);
  if (!preview) throw new Error('Something went wrong. Try again.');
  return preview;
}

/** Make the reset. Answers its History action, for Undo. */
export async function applyReset(ask: ResetAsk): Promise<string> {
  const { action } = await apiPost('/api/resets', { ...ask, apply: true }, ResetResponse);
  if (!action) throw new Error('Something went wrong. Try again.');
  return action;
}
