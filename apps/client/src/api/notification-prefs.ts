import { humanError, NotificationPrefsDraft, prefsOf, type NotificationPrefs } from '@app/core';

import { supabase } from './supabase';

// What to push you and when to keep quiet: your own row in
// notification_prefs, the same on every device. No row reads as everything
// on, so the first save makes it.

/** Your settings, or the defaults if you've never changed them. */
export async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('reminders, checks, flags, deal, quiet_from, quiet_until, timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(humanError(error));
  return prefsOf(data);
}

/** This device's time zone, which quiet hours are read in. */
export function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Save them all at once. Quiet hours are kept in this device's zone. */
export async function savePrefs(userId: string, prefs: NotificationPrefs): Promise<void> {
  const parsed = NotificationPrefsDraft.safeParse({ ...prefs, timezone: deviceZone() ?? prefs.timezone });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const p = parsed.data;
  const { error } = await supabase.from('notification_prefs').upsert({
    user_id: userId,
    reminders: p.reminders,
    checks: p.checks,
    flags: p.flags,
    deal: p.deal,
    quiet_from: p.quietFrom,
    quiet_until: p.quietUntil,
    timezone: p.timezone,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(humanError(error));
}
