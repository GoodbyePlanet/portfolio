import { useState, useEffect } from 'react';

function format(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `T+${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function useMissionElapsedTime() {
  const [elapsed, setElapsed] = useState('T+00:00:00');

  useEffect(() => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(format(Date.now() - start));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return elapsed;
}
