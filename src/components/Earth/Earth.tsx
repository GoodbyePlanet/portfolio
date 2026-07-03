import styles from './Earth.module.css';

export function Earth() {
  return (
    <div className={styles.earthWrapper}>
      {/* Layered atmosphere rim */}
      <div className={styles.atmosphereOuter} />
      <div className={styles.atmosphereMid} />
      <div className={styles.atmosphereInner} />
      <div className={styles.rimArc} />

      {/* Lonely satellite drifting across the horizon */}
      <div className={styles.satellite} />

      {/* Planet surface */}
      <div className={styles.earth}>
        {/* Terminator line — day/night boundary */}
        <div className={styles.terminator} />
        {/* City lights on the night side */}
        <div className={styles.cityLights} />
      </div>
    </div>
  );
}