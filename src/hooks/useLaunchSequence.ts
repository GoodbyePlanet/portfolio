import { useState, useCallback, useRef, useEffect } from 'react';

export type LaunchPhase = 'idle' | 'launching' | 'returning';

export function useLaunchSequence(onThemeToggle: () => void) {
  const [phase, setPhase] = useState<LaunchPhase>('idle');
  const [isShaking, setIsShaking] = useState(false);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  const schedule = (fn: () => void, delay: number) => {
    timeouts.current.push(window.setTimeout(fn, delay));
  };

  const launch = useCallback(() => {
    if (phase !== 'idle') return;

    timeouts.current = [];

    setPhase('launching');
    setIsShaking(true);
    schedule(() => setIsShaking(false), 600);

    // Toggle theme while rocket is off-screen
    schedule(() => onThemeToggle(), 1800);

    // Transition to returning
    schedule(() => setPhase('returning'), 2200);

    // Back to idle
    schedule(() => setPhase('idle'), 4700);
  }, [phase, onThemeToggle]);

  return { phase, isShaking, launch };
}
