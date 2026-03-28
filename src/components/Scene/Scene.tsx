import type { ReactNode } from 'react';
import styles from './Scene.module.css';

interface SceneProps {
  shake: boolean;
  children: ReactNode;
}

export function Scene({ shake, children }: SceneProps) {
  const className = `${styles.scene}${shake ? ` ${styles.shake}` : ''}`;
  return (
    <div className={className} id="scene">
      {children}
    </div>
  );
}
