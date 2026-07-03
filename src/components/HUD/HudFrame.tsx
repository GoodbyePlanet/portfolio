import type { ReactNode } from 'react';
import styles from './HUD.module.css';

interface HudFrameProps {
  title: string;
  corner?: ReactNode;
  children: ReactNode;
}

export function HudFrame({ title, corner, children }: HudFrameProps) {
  return (
    <div className={styles.hudFrame}>
      <div className={styles.hudScanlines} />
      <div className={styles.hudHeader}>
        <span className={styles.hudPrompt}>&gt;</span> <span>{title}</span>
        {corner && <span className={styles.hudCorner}>{corner}</span>}
      </div>
      {children}
    </div>
  );
}
