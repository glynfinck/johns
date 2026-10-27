import { JOHN_COPY } from '@app/core';
import { useState } from 'react';

import { coverJohn, markDone } from '@/api/johns';
import { pickPhoto, uploadProof } from '@/api/photos';
import { useMove } from '@/hooks/use-move';

/**
 * Ticking one John: as it is, or with a photo receipt from the camera or the
 * library, uploaded first. `problem` is the sentence to show when the photo
 * or the database said no. With `cover`, the John is a housemate's and the
 * tick covers it (cover_john) rather than marking your own done.
 */
export function useTick(houseId: string, assignmentId: string, { cover = false }: { cover?: boolean } = {}) {
  const done = cover ? coverJohn : markDone;
  const move = useMove(houseId);
  const [uploading, setUploading] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);

  async function tickWithPhoto(source: 'camera' | 'library') {
    setPhotoProblem(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(source);
    } catch (reason) {
      setPhotoProblem(reason instanceof Error ? reason.message : JOHN_COPY.photoFailed);
      return;
    }
    if (!uri) return;
    setUploading(true);
    let path: string;
    try {
      path = await uploadProof(houseId, assignmentId, uri);
    } catch {
      setPhotoProblem(JOHN_COPY.photoFailed);
      return;
    } finally {
      setUploading(false);
    }
    await move.run(() => done(assignmentId, path));
  }

  function tick() {
    setPhotoProblem(null);
    return move.run(() => done(assignmentId));
  }

  return {
    pending: move.pending,
    uploading,
    busy: move.pending || uploading,
    problem: photoProblem ?? move.problem,
    tick,
    tickWithPhoto,
  };
}
