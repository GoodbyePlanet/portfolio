import {
  type ConstellationId,
  type ConstellationState,
  CONSTELLATIONS,
} from '../../hooks/useConstellationNav';
import styles from './ConstellationNav.module.css';

interface Props {
  states: Record<ConstellationId, ConstellationState>;
  onStarClick: (id: ConstellationId, starIndex: number) => void;
}

export function ConstellationNav({ states, onStarClick }: Props) {
  return (
    <div className={styles.container}>
      {/* SVG lines between stars */}
      <svg
        className={styles.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {CONSTELLATIONS.map((c) => {
          const state = states[c.id];
          const { stars } = c;
          const complete = state.completed;

          return (
            <g key={c.id}>
              {/* Line 0→1 */}
              {state.clickedCount >= 1 && (
                <line
                  x1={stars[0].x}
                  y1={stars[0].y}
                  x2={stars[1].x}
                  y2={stars[1].y}
                  className={`${styles.line} ${complete ? styles.lineComplete : ''}`}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {/* Line 1→2 */}
              {state.clickedCount >= 2 && (
                <line
                  x1={stars[1].x}
                  y1={stars[1].y}
                  x2={stars[2].x}
                  y2={stars[2].y}
                  className={`${styles.line} ${complete ? styles.lineComplete : ''}`}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {/* Closing line 2→0 */}
              {complete && (
                <line
                  x1={stars[2].x}
                  y1={stars[2].y}
                  x2={stars[0].x}
                  y2={stars[0].y}
                  className={`${styles.line} ${styles.lineClosing} ${styles.lineComplete}`}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Clickable stars */}
      {CONSTELLATIONS.map((c) => {
        const state = states[c.id];

        return c.stars.map((star, i) => {
          const isClicked = i < state.clickedCount;
          const isNext = i === state.clickedCount && !state.completed;
          const isFirstHint = i === 0 && state.clickedCount === 0;

          const className = [
            styles.navPoint,
            isClicked ? styles.clicked : '',
            isNext && !isFirstHint ? styles.next : '',
            isFirstHint ? styles.hint : '',
            state.completed ? styles.completed : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={`${c.id}-${i}`}
              className={className}
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
              onClick={() => onStarClick(c.id, i)}
              aria-label={`${c.label} constellation star ${i + 1}`}
            />
          );
        });
      })}

      {/* Labels for completed constellations */}
      {CONSTELLATIONS.map((c) => {
        if (!states[c.id].completed) return null;

        const cx = c.stars.reduce((s, p) => s + p.x, 0) / c.stars.length;
        const cy = c.stars.reduce((s, p) => s + p.y, 0) / c.stars.length;

        return (
          <span
            key={`label-${c.id}`}
            className={styles.label}
            style={{ left: `${cx}%`, top: `${cy}%` }}
          >
            {c.label}
          </span>
        );
      })}
    </div>
  );
}