import { FlagResponse, RaiseFlag } from '@app/core';

import { apiPost } from './http';

// On-call Johns. Flagging goes through apps/api, which runs raise_flag as you
// and then tells whoever is on call (lib/moves/flags.ts there).

/** Say an on-call John needs doing. Answers the flag's id: the one already open, if it is. */
export async function raiseFlag(johnId: string): Promise<string> {
  const { assignmentId } = await apiPost('/api/flags', RaiseFlag.parse({ johnId }), FlagResponse);
  return assignmentId;
}
