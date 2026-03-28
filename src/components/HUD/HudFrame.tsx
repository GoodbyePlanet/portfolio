import type { ReactNode } from 'react';
import styles from './HUD.module.css';

interface HudFrameProps {
  title: string;
  children: ReactNode;
}

export function HudFrame({ title, children }: HudFrameProps) {
  return (
    <div className={styles.hudFrame}>
      <div className={styles.hudScanlines} />
      <div className={styles.hudHeader}>
        &gt; <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
