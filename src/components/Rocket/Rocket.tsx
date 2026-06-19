import { useRef } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import { Sprinkles } from '../Particles/Sprinkles';
import { Smoke } from '../Particles/Smoke';
import styles from './Rocket.module.css';

interface RocketProps {
  phase: LaunchPhase;
  onLaunch: () => void;
  onPhaseEnd: () => void;
}

export function Rocket({ phase, onLaunch, onPhaseEnd }: RocketProps) {
  const rocketRef = useRef<HTMLDivElement>(null);

  const phaseClass = styles[phase] || '';

  return (
    <div className={styles.rocketScale} ref={rocketRef} id="rocket">
      <div
        className={`${styles.rocketFloat} ${phaseClass}`}
        onAnimationEnd={(e) => {
          // Only this layer's own finite launch/return animations reach here;
          // the idle float and flame burn animations loop forever.
          if (e.target === e.currentTarget) onPhaseEnd();
        }}
      >
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
      </div>

      <Sprinkles rocketRef={rocketRef} phase={phase} />
      <Smoke rocketRef={rocketRef} phase={phase} />
    </div>
  );
}
