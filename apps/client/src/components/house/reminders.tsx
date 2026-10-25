import { ME_COPY, REMINDERS_COPY } from '@app/core';
import { BellIcon, BellOffIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { reminderSupport, remindersOn, turnRemindersOff, turnRemindersOn } from '@/api/push';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Body, Eyebrow } from '@/components/text';
import { SPACE } from '@/theme';

/**
 * Reminders on this device, as the web's You card has them: a browser's push
 * notifications, on or off. Nothing shows where there's nothing to offer yet
 * (a phone, until native push; a build without the VAPID key).
 */
export function Reminders({ userId }: { userId: string }) {
  const support = reminderSupport();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (support !== 'ready') return;
    let alive = true;
    void remindersOn().then((now) => {
      if (alive) setOn(now);
    });
    return () => {
      alive = false;
    };
  }, [support]);

  if (support === 'none') return null;

  async function enable() {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      if ((await turnRemindersOn(userId)) === 'blocked') {
        setProblem(REMINDERS_COPY.blocked);
        return;
      }
      setOn(true);
      setNotice(REMINDERS_COPY.turnedOn);
    } catch {
      setProblem(REMINDERS_COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      await turnRemindersOff();
      setOn(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack} testID="reminders">
      <Eyebrow>{ME_COPY.reminders}</Eyebrow>
      {support === 'unsupported' ? (
        <Body muted style={styles.small}>
          {REMINDERS_COPY.unsupported}
        </Body>
      ) : on === null ? null : (
        <View style={styles.start}>
          {on ? (
            <Button variant="outline" icon={BellOffIcon} label={REMINDERS_COPY.off} disabled={busy} onPress={() => void disable()} />
          ) : (
            <Button icon={BellIcon} label={REMINDERS_COPY.on} disabled={busy} onPress={() => void enable()} testID="enable-push" />
          )}
        </View>
      )}
      {problem ? <Alert message={problem} /> : null}
      <View accessibilityLiveRegion="polite">{notice ? <Body muted style={styles.small}>{notice}</Body> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.sm },
  start: { alignItems: 'flex-start' },
  small: { fontSize: 13, lineHeight: 18 },
});
