import { SWAP_COPY } from '@app/core';
import { RepeatIcon } from 'lucide-react-native';
import { useState } from 'react';

import { spendSwap } from '@/api/johns';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Sheet } from '@/components/sheet';
import { useMove } from '@/hooks/use-move';

/** Top of the table: trade one of your open Johns for a housemate's. Nothing shows without both. */
export function SwapSheet({
  houseId,
  mine,
  theirs,
}: {
  houseId: string;
  mine: { id: string; name: string }[];
  theirs: { id: string; name: string; owner: string }[];
}) {
  const move = useMove(houseId);
  const [open, setOpen] = useState(false);
  const [give, setGive] = useState(mine[0]?.id ?? '');
  const [take, setTake] = useState('');
  if (mine.length === 0 || theirs.length === 0) return null;

  async function swap() {
    if (await move.run(() => spendSwap(give, take))) setOpen(false);
  }

  return (
    <>
      <Button variant="outline" icon={RepeatIcon} label={SWAP_COPY.open} onPress={() => setOpen(true)} testID="swap" />
      <Sheet visible={open} title={SWAP_COPY.title} description={SWAP_COPY.body} onClose={() => setOpen(false)}>
        <Choice
          label={SWAP_COPY.give}
          options={mine.map((m) => ({ value: m.id, label: m.name }))}
          value={give}
          onChange={setGive}
        />
        <Choice
          label={SWAP_COPY.take}
          options={theirs.map((t) => ({ value: t.id, label: `${t.name} · ${t.owner}`, spoken: `${t.name}, ${t.owner}'s` }))}
          value={take}
          onChange={setTake}
        />
        {move.problem ? <Alert message={move.problem} /> : null}
        <Button
          label={move.pending ? SWAP_COPY.swapping : SWAP_COPY.swap}
          disabled={move.pending || !give || !take}
          onPress={() => void swap()}
        />
      </Sheet>
    </>
  );
}
