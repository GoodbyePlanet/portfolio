import { useEffect, useRef, useCallback } from 'react';
import styles from './ShootingStars.module.css';

export function ShootingStars() {
  const containerRef = useRef<HTMLDivElement>(null);

  const createShootingStar = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const star = document.createElement('div');
    star.className = styles.shootingStar;
    star.style.left = `${Math.random() * 60 + 20}%`;
    star.style.top = `${Math.random() * 40}%`;

    const duration = Math.random() * 1.5 + 0.8;
    star.style.animation = `${styles.shoot || 'shoot'} ${duration}s linear forwards`;

    // Inject keyframes if not using CSS module animation name
    star.style.animationName = 'shoot';

    container.appendChild(star);
    setTimeout(() => star.remove(), duration * 1000 + 100);
  }, []);

  useEffect(() => {
    let active = true;

    const schedule = () => {
      const delay = Math.random() * 4000 + 2000;
      setTimeout(() => {
        if (!active) return;
        createShootingStar();
        schedule();
      }, delay);
    };

    schedule();
    return () => { active = false; };
  }, [createShootingStar]);

  return (
    <>
      <style>{`
        @keyframes shoot {
          0% { opacity: 0; transform: translate(0, 0) rotate(-35deg); }
          5% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translate(-400px, 250px) rotate(-35deg); }
        }
      `}</style>
      <div ref={containerRef} />
    </>
  );
}
