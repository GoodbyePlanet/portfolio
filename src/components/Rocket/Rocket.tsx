import { useRef, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import type { MousePos } from '../../hooks/useParallax';
import { useTilt } from '../../hooks/useTilt';
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
  const tiltRef = useRef<HTMLDivElement>(null);

  useTilt(tiltRef, mouseRef, { maxDeg: 6, perspective: 600, enabled: phase === 'idle' });

  const phaseClass = styles[phase] || '';

  const className = `${styles.rocketContainer} ${phaseClass}`;

  return (
    <div className={className} ref={rocketRef} id="rocket">
      <div className={styles.rocketTilt} ref={tiltRef}>
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

        <div className={styles.clickHint} onClick={onLaunch} />
      </div>

      <Sprinkles rocketRef={rocketRef} phase={phase} />
      <Smoke rocketRef={rocketRef} phase={phase} />
    </div>
  );
}
