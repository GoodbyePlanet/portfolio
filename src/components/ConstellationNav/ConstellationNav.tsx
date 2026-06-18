import { type CSSProperties } from 'react';
import {
  type NavState,
  NAV_STARS,
  NAV_EDGES,
  NAV_LABEL_POS,
  BEACONS,
  segmentOf,
} from '../../hooks/useConstellationNav';
import styles from './ConstellationNav.module.css';

interface Props {
  state: NavState;
  onStarClick: (starIndex: number) => void;
}

export function ConstellationNav({ state, onStarClick }: Props) {
  const { clickedSegments, completed } = state;

  return (
    <div className={styles.container}>
      {/* SVG lines between stars */}
      <svg
        className={styles.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {NAV_EDGES.map((edge) =>
          edge.segment < clickedSegments ? (
            <line
              key={`line-${edge.from}-${edge.to}`}
              x1={NAV_STARS[edge.from].x}
              y1={NAV_STARS[edge.from].y}
              x2={NAV_STARS[edge.to].x}
              y2={NAV_STARS[edge.to].y}
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
            className={`${styles.spark} ${edge.closing ? styles.sparkClosing : ''}`}
            style={
              {
                '--start-x': `${NAV_STARS[edge.from].x}%`,
                '--start-y': `${NAV_STARS[edge.from].y}%`,
                '--end-x': `${NAV_STARS[edge.to].x}%`,
                '--end-y': `${NAV_STARS[edge.to].y}%`,
              } as CSSProperties
            }
          />
        ) : null,
      )}

      {/* Stars: lit segment stars + the single next beacon */}
      {NAV_STARS.map((star, i) => {
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

        return (
          <button
            key={i}
            className={className}
            style={{ left: `${star.x}%`, top: `${star.y}%` }}
            onClick={() => onStarClick(i)}
            aria-label={`Rocket constellation beacon ${segment + 1}`}
          />
        );
      })}

      {/* Label appears once the rocket is complete */}
      {completed && (
        <span
          className={styles.label}
          style={{ left: `${NAV_LABEL_POS.x}%`, top: `${NAV_LABEL_POS.y}%` }}
        >
          IGNITION
        </span>
      )}
    </div>
  );
}
