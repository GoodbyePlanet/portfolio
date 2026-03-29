import { useEffect, useCallback, useState, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import styles from './Particles.module.css';

const SPREAD = 30;
const DRIFT_X_RANGE = 150;
const FALL_MIN = 100;
const FALL_RANGE = 300;
const MIN_DURATION = 0.5;
const DURATION_RANGE = 0.7;
const HOVER_BATCH = 12;
const LAUNCH_COUNT = 40;
const LAUNCH_INTERVAL = 20;
const RETURN_COUNT = 20;
const RETURN_INTERVAL = 30;
const RETURN_DELAY = 500;
const EXHAUST_OFFSET_Y = 180;
const RETURN_OFFSET_Y = 100;

interface Sprinkle {
  id: number;
  x: number;
  y: number;
  tx: string;
  ty: string;
  duration: number;
}

interface SprinklesProps {
  rocketRef: RefObject<HTMLDivElement | null>;
  phase: LaunchPhase;
}

let nextId = 0;

export function Sprinkles({ rocketRef, phase }: SprinklesProps) {
  const [sprinkles, setSprinkles] = useState<Sprinkle[]>([]);
  const timersRef = useRef<number[]>([]);

  const spawn = useCallback((x: number, y: number) => {
    const ox = (Math.random() - 0.5) * SPREAD;
    const oy = (Math.random() - 0.5) * SPREAD;
    const duration = Math.random() * DURATION_RANGE + MIN_DURATION;

    const sprinkle: Sprinkle = {
      id: nextId++,
      x: x + ox,
      y: y + oy,
      tx: `${(Math.random() - 0.5) * DRIFT_X_RANGE}px`,
      ty: `${Math.random() * FALL_RANGE + FALL_MIN}px`,
      duration,
    };

    setSprinkles((prev) => [...prev, sprinkle]);

    const timer = window.setTimeout(() => {
      setSprinkles((prev) => prev.filter((s) => s.id !== sprinkle.id));
    }, duration * 1000 + 100);

    timersRef.current.push(timer);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // Hover sprinkles on exhaust area
  useEffect(() => {
    const rocket = rocketRef.current;
    if (!rocket) return;

    const trigger = rocket.querySelector<HTMLElement>('[class*="exhaustTrigger"]');
    if (!trigger) return;

    let isHovering = false;
    let lastSpawnTime = 0;
    const HOVER_THROTTLE = 80;

    const onEnter = () => { isHovering = true; };
    const onLeave = () => { isHovering = false; };
    const onMove = (e: MouseEvent) => {
      if (!isHovering) return;
      const now = performance.now();
      if (now - lastSpawnTime < HOVER_THROTTLE) return;
      lastSpawnTime = now;
      for (let i = 0; i < HOVER_BATCH; i++) spawn(e.clientX, e.clientY);
    };

    trigger.addEventListener('mouseenter', onEnter);
    trigger.addEventListener('mouseleave', onLeave);
    trigger.addEventListener('mousemove', onMove);

    return () => {
      trigger.removeEventListener('mouseenter', onEnter);
      trigger.removeEventListener('mouseleave', onLeave);
      trigger.removeEventListener('mousemove', onMove);
    };
  }, [rocketRef, spawn]);

  // Burst sprinkles on launch
  useEffect(() => {
    if (phase !== 'launching') return;

    const rocket = rocketRef.current;
    if (!rocket) return;

    const rect = rocket.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + EXHAUST_OFFSET_Y;

    const timeouts: number[] = [];
    for (let i = 0; i < LAUNCH_COUNT; i++) {
      timeouts.push(window.setTimeout(() => spawn(cx, cy), i * LAUNCH_INTERVAL));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [phase, rocketRef, spawn]);

  // Burst sprinkles on return
  useEffect(() => {
    if (phase !== 'returning') return;

    const timeouts: number[] = [];
    const burst = window.setTimeout(() => {
      const rocket = rocketRef.current;
      if (!rocket) return;
      const rect = rocket.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      for (let i = 0; i < RETURN_COUNT; i++) {
        timeouts.push(
          window.setTimeout(() => spawn(cx, window.innerHeight - RETURN_OFFSET_Y), i * RETURN_INTERVAL)
        );
      }
    }, RETURN_DELAY);

    timeouts.push(burst);
    return () => timeouts.forEach(clearTimeout);
  }, [phase, rocketRef, spawn]);

  return createPortal(
    <>
      {sprinkles.map((s) => (
        <div
          key={s.id}
          className={styles.sprinkle}
          style={{
            left: s.x,
            top: s.y,
            '--tx': s.tx,
            '--ty': s.ty,
            '--duration': `${s.duration}s`,
          } as React.CSSProperties}
        />
      ))}
    </>,
    document.body
  );
}