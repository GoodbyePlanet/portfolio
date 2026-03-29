import { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useParallax } from './hooks/useParallax';
import { useLaunchSequence } from './hooks/useLaunchSequence';
import { useConstellationNav } from './hooks/useConstellationNav';
import { Scene } from './components/Scene/Scene';
import { Nebula } from './components/Nebula/Nebula';
import { StarField } from './components/Stars/StarField';
import { Constellations } from './components/Constellations/Constellations';
import { ConstellationNav } from './components/ConstellationNav/ConstellationNav';
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
  const { states, handleStarClick } = useConstellationNav();

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <Scene shake={isShaking}>
      <div className={styles.hudMobileContainer}>
        <HudPanel visible={isMobile || states.info.panelOpen} />
        <HudRight
          projectsVisible={isMobile || states.projects.panelOpen}
          logsVisible={isMobile || states.logs.panelOpen}
        />
      </div>
      <Nebula />
      <StarField mouseRef={mouseRef} />
      <Constellations mouseRef={mouseRef} />
      <ConstellationNav states={states} onStarClick={handleStarClick} />
      <ShootingStars />
      <CursorTrail mouseRef={mouseRef} />
      <Earth />
      <Rocket phase={phase} mouseRef={mouseRef} onLaunch={launch} />
      <span className={styles.tagline}>The universe rewards the curious.</span>
    </Scene>
  );
}