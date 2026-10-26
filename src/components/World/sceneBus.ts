/**
 * The few facts the world layer shares with the DOM and the rocket's own
 * canvas, written by the world every frame it changes them. Plain mutable
 * state plus a listener set, so nothing re-renders through React.
 */
import { NAV_STARS, NAV_LABEL_POS } from '../../hooks/useConstellationNav';

/** Viewport px of each nav star, then the label: [x0, y0, x1, y1, ...].
 *  Seeded with the lined-up layout until the world's first frame. */
export const navScreen = new Float32Array(
  [...NAV_STARS, NAV_LABEL_POS].flatMap((s) => [
    (s.x / 100) * window.innerWidth,
    (s.y / 100) * window.innerHeight,
  ]),
);

/** Viewport y (px) of the top of the Earth's horizon. */
export const horizon = { y: window.innerHeight * 0.85 };

const listeners = new Set<() => void>();

export function publishNavScreen() {
  listeners.forEach((l) => l());
}

export function subscribeNavScreen(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
