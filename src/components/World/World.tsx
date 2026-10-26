import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { MousePos } from '../../hooks/useParallax';
import { createWorld, type ThemeColors, type World as WorldHandle } from './worldScene';
import styles from './World.module.css';

interface WorldProps {
  mouseRef: RefObject<MousePos | null>;
  /** 0 = rocket constellation scattered, 1 = lined up. */
  alignment: number;
}

function readTheme(): ThemeColors {
  const root = document.documentElement;
  const s = getComputedStyle(root);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  const n = (name: string, fallback: number) => parseFloat(v(name, String(fallback)));
  const light = root.getAttribute('data-theme') === 'light';
  return {
    star: new THREE.Color(v('--star-color', 'white')),
    starOpacity: n('--star-opacity', 0.1),
    starPeak: n('--star-peak-opacity', 0.8),
    link: new THREE.Color(light ? 'rgb(60, 60, 80)' : 'rgb(180, 200, 255)'),
    satellite: new THREE.Color(v('--accent-amber', '#ffb347')),
    earth: {
      base: new THREE.Color(v('--earth-base', '#1c1f26')),
      detail: new THREE.Color(v('--earth-detail', '#2a2e36')),
      rim: new THREE.Color(light ? 'rgb(60, 100, 180)' : 'rgb(140, 190, 255)'),
      halo: new THREE.Color(light ? 'rgb(20, 24, 34)' : 'rgb(190, 215, 255)'),
      haloAlpha: light ? 0.25 : 0.3,
    },
    light,
  };
}

export function World({ mouseRef, alignment }: WorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WorldHandle | null>(null);
  // Read once at mount so the page opens on the current pose, not mid-swing.
  const initialAlignment = useRef(alignment);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const world = createWorld({
      mouse: () => mouseRef.current,
      alignment: initialAlignment.current,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    world.canvas.className = styles.canvas;
    host.appendChild(world.canvas);
    world.setTheme(readTheme());
    worldRef.current = world;

    const observer = new MutationObserver(() => world.setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      observer.disconnect();
      world.dispose();
      world.canvas.remove();
      worldRef.current = null;
    };
  }, [mouseRef]);

  useEffect(() => {
    worldRef.current?.setAlignment(alignment);
  }, [alignment]);

  return <div className={styles.host} ref={hostRef} aria-hidden="true" />;
}
