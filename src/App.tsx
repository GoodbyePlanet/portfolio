import { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useParallax } from './hooks/useParallax';
import { useLaunchSequence } from './hooks/useLaunchSequence';
import { useConstellationNav, NUM_SEGMENTS } from './hooks/useConstellationNav';
import { Scene } from './components/Scene/Scene';
import { Nebula } from './components/Nebula/Nebula';
import { World } from './components/World/World';
import { ConstellationNav } from './components/ConstellationNav/ConstellationNav';
import { ShootingStars } from './components/ShootingStars/ShootingStars';
import { CursorTrail } from './components/CursorTrail/CursorTrail';
import { Rocket } from './components/Rocket/Rocket';
import { HudPanel } from './components/HUD/HudPanel';
import { HudRight } from './components/HUD/HudRight';
import styles from './App.module.css';

export default function App() {
  const { toggle } = useTheme();
  const mouseRef = useParallax();
  const { phase, isShaking, launch, onPhaseEnd } = useLaunchSequence(toggle);
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

  // The camera turns toward the view that lines the constellation up as it is
  // drawn. Phones skip the constellation, so they start lined up.
  const alignment = isMobile || state.completed ? 1 : state.clickedSegments / NUM_SEGMENTS;

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
      <World mouseRef={mouseRef} alignment={alignment} />
      <ConstellationNav state={state} onStarClick={handleStarClick} />
      <ShootingStars />
      <CursorTrail mouseRef={mouseRef} />
      <Rocket phase={phase} onLaunch={launch} onPhaseEnd={onPhaseEnd} />
      <span className={styles.tagline}>The universe rewards the curious.</span>
    </Scene>
  );
}