// Reminders on a phone come with native push (Phase 12 of
// docs/specs/native-migration.md). Until then there's nothing to offer here;
// the web build has push.web.ts.

export function reminderSupport(): 'none' | 'unsupported' | 'ready' {
  return 'none';
}

export async function remindersOn(): Promise<boolean> {
  return false;
}

export async function turnRemindersOn(_userId: string): Promise<'on' | 'blocked'> {
  return 'blocked';
}

export async function turnRemindersOff(): Promise<void> {}
