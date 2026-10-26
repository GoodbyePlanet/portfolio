import { useRef, useState } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import { Sprinkles } from '../Particles/Sprinkles';
import { Rocket3D } from './Rocket3D';
import styles from './Rocket.module.css';

interface RocketProps {
  phase: LaunchPhase;
  onLaunch: () => void;
  onPhaseEnd: () => void;
}

export function Rocket({ phase, onLaunch, onPhaseEnd }: RocketProps) {
  const rocketRef = useRef<HTMLDivElement>(null);
  const [boost, setBoost] = useState(false);
  const [spin, setSpin] = useState(false);

  const phaseClass = styles[phase] || '';

  return (
    <div
      className={`${styles.rocketScale}${phase === 'idle' ? ` ${styles.rocketDrift}` : ''}`}
      ref={rocketRef}
      id="rocket"
    >
      <div
        className={`${styles.rocketFloat} ${phaseClass}`}
        onAnimationEnd={(e) => {
          // Only this layer's own finite launch/return animations reach here;
          // the idle float animation loops forever.
          if (e.target === e.currentTarget) onPhaseEnd();
        }}
      >
        <div
          className={styles.clickHint}
          onClick={onLaunch}
          onMouseEnter={() => setSpin(true)}
          onMouseLeave={() => setSpin(false)}
        />

        {/* Hull and plume are both drawn by three.js inside this box, which
            keeps the exact footprint the CSS rocket had so the click target
            and the particle bursts still line up. */}
        <div className={styles.rocketBody}>
          <Rocket3D phase={phase} boost={boost} spin={spin} />
        </div>

        <div
          className={styles.exhaustTrigger}
          onMouseEnter={() => setBoost(true)}
          onMouseLeave={() => setBoost(false)}
        />
      </div>

      <Sprinkles rocketRef={rocketRef} phase={phase} />
    </div>
  );
}
