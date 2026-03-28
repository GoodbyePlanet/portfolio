import { useTheme } from './hooks/useTheme';
import { useParallax } from './hooks/useParallax';
import { useLaunchSequence } from './hooks/useLaunchSequence';
import { Scene } from './components/Scene/Scene';
import { Nebula } from './components/Nebula/Nebula';
import { StarField } from './components/Stars/StarField';
import { Constellations } from './components/Constellations/Constellations';
import { ShootingStars } from './components/ShootingStars/ShootingStars';
import { CursorTrail } from './components/CursorTrail/CursorTrail';
import { Earth } from './components/Earth/Earth';
import { Rocket } from './components/Rocket/Rocket';
import { HudPanel } from './components/HUD/HudPanel';
import { HudRight } from './components/HUD/HudRight';
import styles from './App.module.css';

export default function App() {
  const { toggle } = useTheme();
  const mouseRef = useParallax();
  const { phase, isShaking, launch } = useLaunchSequence(toggle);

  return (
    <Scene shake={isShaking}>
      <div className={styles.hudMobileContainer}>
        <HudPanel />
        <HudRight />
      </div>
      <Nebula />
      <StarField mouseRef={mouseRef} />
      <Constellations mouseRef={mouseRef} />
      <ShootingStars />
      <CursorTrail mouseRef={mouseRef} />
      <Earth />
      <Rocket phase={phase} mouseRef={mouseRef} onLaunch={launch} />
    </Scene>
  );
}
