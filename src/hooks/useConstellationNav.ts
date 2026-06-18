import { useState, useEffect, useCallback } from 'react';

export interface NavStar {
  x: number;
  y: number;
}

/**
 * A single large, detailed "rocket" constellation that frames the real rocket
 * (which is centered at x≈50%, y≈25-45%). Coordinates are percentages on a
 * 0-100 grid (see ConstellationNav viewBox). Vertices stay on the perimeter,
 * clear of the rocket, so they remain clickable above it. The outline is
 * symmetric about the vertical axis (x=50).
 *
 * Stars are grouped into segments by BEACONS below. Only the first star of
 * each segment is a clickable "beacon"; clicking it draws that whole arc of the
 * outline at once — so the detailed shape needs only a few clicks.
 * Ordered clockwise: nose → right body/fin → engines → left fin/body → close.
 */
export const NAV_STARS: NavStar[] = [
  { x: 50, y: 7 },   // 0  nose tip          ── beacon (segment 0)
  { x: 58, y: 16 },  // 1  nose shoulder R
  { x: 61, y: 27 },  // 2  body upper R
  { x: 61, y: 43 },  // 3  body lower R      ── beacon (segment 1)
  { x: 62, y: 51 },  // 4  fin shoulder R
  { x: 73, y: 68 },  // 5  fin tip R
  { x: 56, y: 64 },  // 6  engine R          ── beacon (segment 2)
  { x: 44, y: 64 },  // 7  engine L
  { x: 27, y: 68 },  // 8  fin tip L
  { x: 38, y: 51 },  // 9  fin shoulder L    ── beacon (segment 3)
  { x: 39, y: 43 },  // 10 body lower L
  { x: 39, y: 27 },  // 11 body upper L
  { x: 42, y: 16 },  // 12 nose shoulder L
];

/** Indices of the clickable beacon stars, in click order (one click per segment). */
export const BEACONS = [0, 3, 6, 9];
export const NUM_SEGMENTS = BEACONS.length;

/** Where the completion label sits — above the nose, clear of the rocket. */
export const NAV_LABEL_POS: NavStar = { x: 50, y: 3 };

/** The segment an edge/star belongs to: the last beacon at or before its index. */
export function segmentOf(index: number): number {
  let seg = 0;
  for (let k = 0; k < BEACONS.length; k++) if (BEACONS[k] <= index) seg = k;
  return seg;
}

export interface NavEdge {
  from: number;
  to: number;
  segment: number;
  /** The closing edge back to the first star. */
  closing: boolean;
}

/** Consecutive edges around the closed outline, one per star. */
export const NAV_EDGES: NavEdge[] = NAV_STARS.map((_, i) => {
  const to = (i + 1) % NAV_STARS.length;
  return { from: i, to, segment: segmentOf(i), closing: to === 0 };
});

export interface NavState {
  /** How many segments have been drawn (0..NUM_SEGMENTS). */
  clickedSegments: number;
  completed: boolean;
}

const STORAGE_KEY = 'constellation-nav';

function loadState(): NavState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Guard against stale data from a previous layout.
      if (typeof parsed?.clickedSegments === 'number' && typeof parsed?.completed === 'boolean') {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { clickedSegments: 0, completed: false };
}

export function useConstellationNav() {
  const [state, setState] = useState<NavState>(loadState);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleStarClick = useCallback((starIndex: number) => {
    setState(prev => {
      // Once the rocket is complete it stays complete.
      if (prev.completed) return prev;
      // Only the next segment's beacon advances the sequence.
      if (starIndex !== BEACONS[prev.clickedSegments]) return prev;

      const next = prev.clickedSegments + 1;
      return { clickedSegments: next, completed: next === NUM_SEGMENTS };
    });
  }, []);

  return { state, handleStarClick };
}
