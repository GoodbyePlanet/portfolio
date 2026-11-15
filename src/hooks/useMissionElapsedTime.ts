import { useState, useEffect } from 'react';
import { missionStart } from '../data/pilot';

const START = new Date(missionStart);

/**
 * Mission time since `missionStart`, e.g. `T+9y 205d 04:12:33` (days only,
 * `T+233d …`, in the first year). Years are calendar anniversaries, so leap
 * days don't skew the day count.
 */
function format(now: Date) {
  let years = now.getUTCFullYear() - START.getUTCFullYear();
  const anniversary = new Date(START);
  anniversary.setUTCFullYear(START.getUTCFullYear() + years);
  if (anniversary > now) {
    years -= 1;
    anniversary.setUTCFullYear(START.getUTCFullYear() + years);
  }

  const totalSeconds = Math.max(0, Math.floor((now.getTime() - anniversary.getTime()) / 1000));
  const d = Math.floor(totalSeconds / 86_400);
  const rest = totalSeconds % 86_400;
  const h = Math.floor(rest / 3600);
  const m = Math.floor((rest % 3600) / 60);
  const s = rest % 60;
  const pad = (n: number, width = 2) => n.toString().padStart(width, '0');
  const days = years > 0 ? `${years}y ${pad(d, 3)}d` : `${d}d`;
  return `T+${days} ${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function useMissionElapsedTime() {
  const [elapsed, setElapsed] = useState(() => format(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed(format(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  return elapsed;
}
