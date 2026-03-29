import { useRef, useEffect, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import type { MousePos } from '../../hooks/useParallax';
import { Sprinkles } from '../Particles/Sprinkles';
import { Smoke } from '../Particles/Smoke';
import styles from './Rocket.module.css';

interface RocketProps {
  phase: LaunchPhase;
  mouseRef: RefObject<MousePos | null>;
  onLaunch: () => void;
}

export function Rocket({ phase, mouseRef, onLaunch }: RocketProps) {
  const rocketRef = useRef<HTMLDivElement>(null);

  // Rocket tilt toward cursor (ref-based, no re-renders)
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      if (rocketRef.current && mouseRef.current && phase === 'idle') {
        // Tilt is subtle - applied as CSS custom properties
        // but since idle animation overrides transform, we skip direct transform
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [phase, mouseRef]);

  const phaseClass = styles[phase] || '';

  const className = `${styles.rocketContainer} ${phaseClass}`;

  return (
    <div className={className} ref={rocketRef} id="rocket">
      <div className={styles.clickHint} onClick={onLaunch} />

      <div className={`${styles.fin} ${styles.finLeft}`} />
      <div className={`${styles.fin} ${styles.finRight}`} />
      <div className={styles.rocketBody}>
        <div className={styles.window} />
        <div className={styles.finCenter} />
      </div>

      <div className={styles.exhaustGlow} />

      <div className={styles.exhaustTrigger} />

      <div className={styles.exhaustVisuals}>
        <div className={styles.flameOuter} />
        <div className={styles.flameCore} />
      </div>

      <Sprinkles rocketRef={rocketRef} phase={phase} />
      <Smoke rocketRef={rocketRef} phase={phase} />
    </div>
  );
}
