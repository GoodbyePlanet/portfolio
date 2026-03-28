import { useEffect, useRef } from 'react';

export interface MousePos {
  x: number;
  y: number;
}

export function useParallax() {
  const mouseRef = useRef<MousePos>({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, []);

  return mouseRef;
}
