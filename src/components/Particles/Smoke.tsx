import { useEffect, useCallback, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import styles from './Particles.module.css';

interface SmokeProps {
  rocketRef: RefObject<HTMLDivElement | null>;
  phase: LaunchPhase;
}

export function Smoke({ rocketRef, phase }: SmokeProps) {
  const createSmoke = useCallback(() => {
    const rocket = rocketRef.current;
    if (!rocket) return;

    const smoke = document.createElement('div');
    smoke.className = styles.smoke;

    const rocketRect = rocket.getBoundingClientRect();
    const cx = rocketRect.left + rocketRect.width / 2;
    const cy = rocketRect.top + 180;

    smoke.style.left = `${cx + (Math.random() - 0.5) * 20}px`;
    smoke.style.top = `${cy}px`;

    const size = Math.random() * 15 + 8;
    smoke.style.width = `${size}px`;
    smoke.style.height = `${size}px`;
    smoke.style.background = `rgba(${150 + Math.random() * 50}, ${150 + Math.random() * 50}, ${160 + Math.random() * 50}, 0.3)`;

    const sx = `${(Math.random() - 0.5) * 80}px`;
    const sy = `${Math.random() * 120 + 60}px`;
    smoke.style.setProperty('--sx', sx);
    smoke.style.setProperty('--sy', sy);

    const dur = Math.random() * 1.5 + 1;
    smoke.style.animation = `smokeDrift ${dur}s ease-out forwards`;

    document.body.appendChild(smoke);
    setTimeout(() => smoke.remove(), dur * 1000 + 100);
  }, [rocketRef]);

  useEffect(() => {
    if (phase === 'launching') return;

    const interval = setInterval(() => {
      createSmoke();
    }, 120);

    return () => clearInterval(interval);
  }, [phase, createSmoke]);

  return (
    <style>{`
      @keyframes smokeDrift {
        0% { opacity: 0.15; transform: translate(0, 0) scale(0.5); }
        100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(2); }
      }
    `}</style>
  );
}
