import styles from './Earth.module.css';

export function Earth() {
  return (
    <div className={styles.earthWrapper}>
      {/* Layered atmosphere rim */}
      <div className={styles.atmosphereOuter} />
      <div className={styles.atmosphereMid} />
      <div className={styles.atmosphereInner} />
      <div className={styles.rimArc} />

      {/* Lonely satellite — rides a slowly rotating ring so it follows the horizon curve */}
      <div className={styles.satelliteOrbit}>
        <div className={styles.satellite} />
      </div>

      {/* Planet surface */}
      <div className={styles.earth}>
        {/* Terminator line — day/night boundary */}
        <div className={styles.terminator} />
      </div>
    </div>
  );
}