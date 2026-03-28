import { useEffect, useCallback, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import styles from './Particles.module.css';

interface SprinklesProps {
  rocketRef: RefObject<HTMLDivElement | null>;
  phase: LaunchPhase;
}

export function Sprinkles({ rocketRef, phase }: SprinklesProps) {
  const createSprinkle = useCallback((x: number, y: number) => {
    const s = document.createElement('div');
    s.className = styles.sprinkle;

    const ox = (Math.random() - 0.5) * 30;
    const oy = (Math.random() - 0.5) * 30;
    s.style.left = `${x + ox}px`;
    s.style.top = `${y + oy}px`;

    const tx = `${(Math.random() - 0.5) * 150}px`;
    const ty = `${Math.random() * 300 + 100}px`;
    s.style.setProperty('--tx', tx);
    s.style.setProperty('--ty', ty);

    const dur = Math.random() * 0.7 + 0.5;
    s.style.animation = `sprinkleFall ${dur}s linear forwards`;

    document.body.appendChild(s);
    setTimeout(() => s.remove(), dur * 1000 + 100);
  }, []);

  // Hover sprinkles on exhaust area
  useEffect(() => {
    const rocket = rocketRef.current;
    if (!rocket) return;

    const trigger = rocket.querySelector('[class*="exhaustTrigger"]');
    if (!trigger) return;

    let isHovering = false;

    const onEnter = () => { isHovering = true; };
    const onLeave = () => { isHovering = false; };
    const onMove = (e: Event) => {
      if (!isHovering) return;
      const me = e as MouseEvent;
      for (let i = 0; i < 5; i++) createSprinkle(me.clientX, me.clientY);
    };

    trigger.addEventListener('mouseenter', onEnter);
    trigger.addEventListener('mouseleave', onLeave);
    trigger.addEventListener('mousemove', onMove);

    return () => {
      trigger.removeEventListener('mouseenter', onEnter);
      trigger.removeEventListener('mouseleave', onLeave);
      trigger.removeEventListener('mousemove', onMove);
    };
  }, [rocketRef, createSprinkle]);

  // Burst sprinkles on launch
  useEffect(() => {
    if (phase !== 'launching') return;

    const rocket = rocketRef.current;
    if (!rocket) return;

    const rect = rocket.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + 180;

    const timeouts: number[] = [];
    for (let i = 0; i < 40; i++) {
      timeouts.push(window.setTimeout(() => createSprinkle(cx, cy), i * 20));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [phase, rocketRef, createSprinkle]);

  // Burst sprinkles on return
  useEffect(() => {
    if (phase !== 'returning') return;

    const timeouts: number[] = [];
    const burst = window.setTimeout(() => {
      const rocket = rocketRef.current;
      if (!rocket) return;
      const rect = rocket.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      for (let i = 0; i < 20; i++) {
        timeouts.push(
          window.setTimeout(() => createSprinkle(cx, window.innerHeight - 100), i * 30)
        );
      }
    }, 500);

    timeouts.push(burst);
    return () => timeouts.forEach(clearTimeout);
  }, [phase, rocketRef, createSprinkle]);

  return (
    <style>{`
      @keyframes sprinkleFall {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      }
    `}</style>
  );
}
