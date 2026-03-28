import { useMemo, useRef, useEffect, type RefObject } from 'react';
import type { MousePos } from '../../hooks/useParallax';
import styles from './Stars.module.css';

interface StarLayerProps {
  count: number;
  layerIndex: number;
  depth: number;
  mouseRef: RefObject<MousePos | null>;
}

interface StarData {
  left: string;
  top: string;
  size: number;
  duration: string;
  delay: string;
}

export function StarLayer({ count, layerIndex, depth, mouseRef }: StarLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  const stars = useMemo<StarData[]>(() => {
    return Array.from({ length: count }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 85}%`,
      size: Math.random() * (1.5 + layerIndex * 0.5) + 0.5,
      duration: `${Math.random() * 3 + 2}s`,
      delay: `${Math.random() * 5}s`,
    }));
  }, [count, layerIndex]);

  useEffect(() => {
    let rafId: number;
    const animate = () => {
      if (layerRef.current && mouseRef.current) {
        const { x, y } = mouseRef.current;
        const moveX = (x - 0.5) * depth * 100;
        const moveY = (y - 0.5) * depth * 60;
        layerRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [depth, mouseRef]);

  return (
    <div className={styles.starLayer} ref={layerRef}>
      {stars.map((star, i) => (
        <div
          key={i}
          className={styles.star}
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--duration': star.duration,
            animationDelay: star.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
