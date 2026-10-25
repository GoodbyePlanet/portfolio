import { useEffect, useCallback, useRef, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import { createSprinkleField, type SprinkleField } from './sprinkleField';
import styles from './Particles.module.css';

const HOVER_BATCH = 12;
const LAUNCH_COUNT = 40;
const LAUNCH_INTERVAL = 20;
const RETURN_COUNT = 20;
const RETURN_INTERVAL = 30;
const RETURN_DELAY = 500;
const EXHAUST_OFFSET_Y = 180;
const RETURN_OFFSET_Y = 100;

interface SprinklesProps {
  rocketRef: RefObject<HTMLDivElement | null>;
  phase: LaunchPhase;
}

function readTheme() {
  const root = document.documentElement;
  return {
    color: getComputedStyle(root).getPropertyValue('--sprinkle-color').trim() || 'white',
    light: root.getAttribute('data-theme') === 'light',
  };
}

export function Sprinkles({ rocketRef, phase }: SprinklesProps) {
  const fieldRef = useRef<SprinkleField | null>(null);

  // Declared first so the field exists before the effects below can spawn.
  useEffect(() => {
    const field = createSprinkleField();
    field.canvas.className = styles.canvas;
    field.canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(field.canvas);
    fieldRef.current = field;

    const applyTheme = () => {
      const { color, light } = readTheme();
      field.setTheme(color, light);
    };
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      observer.disconnect();
      field.dispose();
      field.canvas.remove();
      fieldRef.current = null;
    };
  }, []);

  const spawn = useCallback((x: number, y: number) => {
    fieldRef.current?.spawn(x, y);
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

  return null;
}
