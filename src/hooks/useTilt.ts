import { useEffect, type RefObject } from 'react';
import type { MousePos } from './useParallax';

interface TiltOptions {
  maxDeg?: number;
  perspective?: number;
  enabled?: boolean;
}

export function useTilt(
  elRef: RefObject<HTMLElement | null>,
  mouseRef: RefObject<MousePos | null>,
  { maxDeg = 5, perspective = 800, enabled = true }: TiltOptions = {},
) {
  useEffect(() => {
    if (!enabled) {
      if (elRef.current) {
        elRef.current.style.transform = '';
      }
      return;
    }

    let rafId: number;

    const animate = () => {
      const el = elRef.current;
      const mouse = mouseRef.current;

      if (el && mouse) {
        // Convert 0–1 range to -1–1
        const x = (mouse.x - 0.5) * 2;
        const y = (mouse.y - 0.5) * 2;

        // rotateY follows horizontal mouse, rotateX follows vertical (inverted)
        const rotY = x * maxDeg;
        const rotX = -y * maxDeg;

        el.style.transform =
          `perspective(${perspective}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [elRef, mouseRef, maxDeg, perspective, enabled]);
}