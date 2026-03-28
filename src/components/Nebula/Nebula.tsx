import styles from './Nebula.module.css';

export function Nebula() {
  return (
    <>
      <div className={`${styles.nebula} ${styles.nebula1}`} />
      <div className={`${styles.nebula} ${styles.nebula2}`} />
      <div className={`${styles.nebula} ${styles.nebula3}`} />
    </>
  );
}
