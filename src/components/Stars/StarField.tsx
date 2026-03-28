import type { RefObject } from 'react';
import type { MousePos } from '../../hooks/useParallax';
import { StarLayer } from './StarLayer';

const LAYERS = [
  { count: 50, depth: 0.02 },
  { count: 60, depth: 0.05 },
  { count: 40, depth: 0.08 },
];

interface StarFieldProps {
  mouseRef: RefObject<MousePos | null>;
}

export function StarField({ mouseRef }: StarFieldProps) {
  return (
    <>
      {LAYERS.map((layer, i) => (
        <StarLayer
          key={i}
          count={layer.count}
          layerIndex={i}
          depth={layer.depth}
          mouseRef={mouseRef}
        />
      ))}
    </>
  );
}
