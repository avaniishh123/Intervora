import { useState, useEffect, useRef } from 'react';

/**
 * useSessionTimer — returns a formatted elapsed time string (e.g. "12:34")
 * that ticks every second once startedAt is provided.
 * Only active for human interview mode.
 */
export function useSessionTimer(startedAt: string | undefined): string {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const base = new Date(startedAt).getTime();

    const tick = () => {
      setElapsed(Math.floor((Date.now() - base) / 1000));
    };

    tick(); // immediate first tick
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
