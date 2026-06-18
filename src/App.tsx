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
  const { state, handleStarClick } = useConstellationNav();

  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Completing the rocket reveals all three panels in a staggered cascade.
  const [reveal, setReveal] = useState({ info: false, projects: false, logs: false });

  useEffect(() => {
    if (isMobile) {
      setReveal({ info: true, projects: true, logs: true });
      return;
    }
    if (!state.completed) {
      setReveal({ info: false, projects: false, logs: false });
      return;
    }
    const timers = [
      window.setTimeout(() => setReveal(r => ({ ...r, info: true })), 0),
      window.setTimeout(() => setReveal(r => ({ ...r, projects: true })), 220),
      window.setTimeout(() => setReveal(r => ({ ...r, logs: true })), 440),
    ];
    return () => timers.forEach(clearTimeout);
  }, [state.completed, isMobile]);

  return (
    <Scene shake={isShaking}>
      <div className={styles.hudMobileContainer}>
        <HudPanel visible={reveal.info} />
        <HudRight
          projectsVisible={reveal.projects}
          logsVisible={reveal.logs}
        />
      </div>
      <Nebula />
      <StarField mouseRef={mouseRef} />
      <Constellations mouseRef={mouseRef} />
      <ConstellationNav state={state} onStarClick={handleStarClick} />
      <ShootingStars />
      <CursorTrail mouseRef={mouseRef} />
      <Earth />
      <Rocket phase={phase} mouseRef={mouseRef} onLaunch={launch} />
      <span className={styles.tagline}>The universe rewards the curious.</span>
    </Scene>
  );
}