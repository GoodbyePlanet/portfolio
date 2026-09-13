import { useRef, type RefObject } from 'react';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import type { MousePos } from '../../hooks/useParallax';
import { Sprinkles } from '../Particles/Sprinkles';
import { Smoke } from '../Particles/Smoke';
import { Rocket3D } from './Rocket3D';
import styles from './Rocket.module.css';

interface RocketProps {
  phase: LaunchPhase;
  onLaunch: () => void;
  onPhaseEnd: () => void;
  mouseRef?: RefObject<MousePos>;
}

export function Rocket({ phase, onLaunch, onPhaseEnd, mouseRef }: RocketProps) {
  const rocketRef = useRef<HTMLDivElement>(null);

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
          // the idle float and flame burn animations loop forever.
          if (e.target === e.currentTarget) onPhaseEnd();
        }}
      >
        <div className={styles.clickHint} onClick={onLaunch} />

        {/* The hull, fins, porthole and engine bell are all rendered by
            three.js inside this box; the glow and flame below stay CSS so
            they keep reading as soft light against the scene. */}
        <div className={styles.rocketBody}>
          <Rocket3D phase={phase} mouseRef={mouseRef} />
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
