import styles from './Earth.module.css';

export function Earth() {
  return (
    <div className={styles.earthWrapper}>
      <div className={styles.atmosphereGlow} />
      <div className={styles.earth} />
    </div>
  );
}
