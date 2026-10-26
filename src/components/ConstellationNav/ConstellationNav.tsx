import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  type NavState,
  NAV_STARS,
  NAV_EDGES,
  BEACONS,
  segmentOf,
} from '../../hooks/useConstellationNav';
import { navScreen, subscribeNavScreen } from '../World/sceneBus';
import styles from './ConstellationNav.module.css';

const LABEL = NAV_STARS.length;
const sx = (i: number) => navScreen[i * 2];
const sy = (i: number) => navScreen[i * 2 + 1];

interface Props {
  state: NavState;
  onStarClick: (starIndex: number) => void;
}

export function ConstellationNav({ state, onStarClick }: Props) {
  const { clickedSegments, completed } = state;
  const containerRef = useRef<HTMLDivElement>(null);

  // The stars live at different depths in the 3D world, which projects them
  // onto the viewport every time its camera moves; follow along here without
  // re-rendering. Each element names the star(s) it tracks in data attributes.
  const place = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-star]').forEach((el) => {
      const i = Number(el.dataset.star);
      el.style.left = `${sx(i)}px`;
      el.style.top = `${sy(i)}px`;
    });
    root.querySelectorAll<SVGLineElement>('line[data-from]').forEach((el) => {
      const a = Number(el.dataset.from);
      const b = Number(el.dataset.to);
      el.setAttribute('x1', String(sx(a)));
      el.setAttribute('y1', String(sy(a)));
      el.setAttribute('x2', String(sx(b)));
      el.setAttribute('y2', String(sy(b)));
    });
    root.querySelectorAll<HTMLElement>('span[data-from]').forEach((el) => {
      const a = Number(el.dataset.from);
      const b = Number(el.dataset.to);
      el.style.setProperty('--sx', `${sx(a)}px`);
      el.style.setProperty('--sy', `${sy(a)}px`);
      el.style.setProperty('--ex', `${sx(b)}px`);
      el.style.setProperty('--ey', `${sy(b)}px`);
    });
  }, []);

  useLayoutEffect(() => subscribeNavScreen(place), [place]);
  // Newly drawn elements get placed before they are painted.
  useLayoutEffect(place, [place, clickedSegments, completed]);

  return (
    <div className={styles.container} ref={containerRef}>
      {/* SVG lines between stars, in viewport px */}
      <svg className={styles.svg}>
        {NAV_EDGES.map((edge) =>
          edge.segment < clickedSegments ? (
            <line
              key={`line-${edge.from}-${edge.to}`}
              data-from={edge.from}
              data-to={edge.to}
              className={[
                styles.line,
                edge.closing ? styles.lineClosing : '',
                completed ? styles.lineComplete : '',
              ]
                .filter(Boolean)
                .join(' ')}
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
      </svg>

      {/* Traveling sparks along freshly drawn lines */}
      {NAV_EDGES.map((edge) =>
        edge.segment < clickedSegments ? (
          <span
            key={`spark-${edge.from}-${edge.to}`}
            data-from={edge.from}
            data-to={edge.to}
            className={`${styles.spark} ${edge.closing ? styles.sparkClosing : ''}`}
          />
        ) : null,
      )}

      {/* Stars: lit segment stars + the single next beacon */}
      {NAV_STARS.map((_, i) => {
        const segment = segmentOf(i);
        const isBeacon = BEACONS.includes(i);
        const isLit = segment < clickedSegments;
        const isNext = isBeacon && segment === clickedSegments && !completed;

        // Only render stars that have been drawn, or the next beacon to click.
        if (!isLit && !isNext) return null;

        const isFirstHint = isNext && clickedSegments === 0;

        const className = [
          styles.navPoint,
          isLit ? styles.clicked : '',
          isNext && !isFirstHint ? styles.next : '',
          isFirstHint ? styles.hint : '',
          completed ? styles.completed : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Deterministic per-star phase offset so lit vertices don't all
        // pulse in lockstep.
        const twinkleDelay = ((i * 0.53) % 3).toFixed(2);

        return (
          <button
            key={i}
            data-star={i}
            className={className}
            style={{ '--twinkle-delay': `${twinkleDelay}s` } as CSSProperties}
            onClick={() => onStarClick(i)}
            aria-label={`Rocket constellation beacon ${segment + 1}`}
          />
        );
      })}

      {/* Label appears once the rocket is complete */}
      {completed && (
        <span className={styles.label} data-star={LABEL}>
          IGNITION
        </span>
      )}
    </div>
  );
}
