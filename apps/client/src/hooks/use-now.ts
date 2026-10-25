import { useEffect, useState } from 'react';

/** The time, moving on every `everyMs`: statuses and "due in 3 hours" follow the clock between reads. */
export function useNow(everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
