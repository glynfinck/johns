import { useEffect, useState } from 'react';

import { getMyName } from '@/api/profile';

/** Your display name, once it has loaded; null until then or if it can't be read. */
export function useMyName(userId: string | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getMyName(userId)
      .then((current) => {
        if (active) setName(current);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  return name;
}
