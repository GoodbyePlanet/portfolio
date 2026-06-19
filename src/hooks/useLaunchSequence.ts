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

    // Toggle theme while the rocket is off-screen near its apex.
    schedule(() => onThemeToggle(), 1800);
  }, [phase, onThemeToggle]);

  // Advance launching -> returning -> idle as each phase's CSS animation
  // finishes, so the JS never has to mirror the CSS durations.
  const onPhaseEnd = useCallback(() => {
    setPhase((p) =>
      p === 'launching' ? 'returning' : p === 'returning' ? 'idle' : p,
    );
  }, []);

  return { phase, isShaking, launch, onPhaseEnd };
}
