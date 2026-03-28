import { useState, useEffect } from 'react';
import { useStaggeredReveal } from '../../hooks/useStaggeredReveal';
import { pilot, socials } from '../../data/pilot';
import { HudFrame } from './HudFrame';
import styles from './HUD.module.css';

const rows = [
  { label: 'Name', value: pilot.name },
  { label: 'Role', value: pilot.role },
  { label: 'Mission', value: pilot.mission },
  { label: 'Status', value: pilot.status },
];

export function HudPanel() {
  const rowVisibility = useStaggeredReveal(rows.length, 800, 200);
  const [socialsVisible, setSocialsVisible] = useState(false);

  useEffect(() => {
    const delay = 800 + rows.length * 200 + 300;
    const t = window.setTimeout(() => setSocialsVisible(true), delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={styles.hudPanel}>
      <HudFrame title="INFO">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`${styles.hudRow}${rowVisibility[i] ? ` ${styles.hudRowVisible}` : ''}`}
          >
            <div className={styles.hudLabel}>{row.label}</div>
            <div className={styles.hudValue}>{row.value}</div>
          </div>
        ))}
        <div className={`${styles.hudSocials}${socialsVisible ? ` ${styles.hudSocialsVisible}` : ''}`}>
          {socials.map((s) => (
            <span
              key={s.label}
              role="link"
              className={styles.hudSocialLink}
              onClick={() => window.open(s.href, '_blank', 'noopener,noreferrer')}
            >
              {s.label}
            </span>
          ))}
        </div>
      </HudFrame>
    </div>
  );
}
