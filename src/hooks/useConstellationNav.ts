import { useState, useEffect, useCallback } from 'react';

export type ConstellationId = 'info' | 'projects' | 'logs';

export interface ConstellationState {
  clickedCount: number;
  completed: boolean;
  panelOpen: boolean;
}

export interface NavStar {
  x: number;
  y: number;
}

export interface ConstellationDef {
  id: ConstellationId;
  stars: NavStar[];
  label: string;
}

export const CONSTELLATIONS: ConstellationDef[] = [
  {
    id: 'info',
    label: 'INFO',
    stars: [
      { x: 20, y: 16 },
      { x: 33, y: 8 },
      { x: 38, y: 22 },
    ],
  },
  {
    id: 'projects',
    label: 'PROJECTS',
    stars: [
      { x: 58, y: 8 },
      { x: 72, y: 14 },
      { x: 66, y: 26 },
    ],
  },
  {
    id: 'logs',
    label: 'LOGS',
    stars: [
      { x: 57, y: 44 },
      { x: 72, y: 38 },
      { x: 66, y: 54 },
    ],
  },
];

type States = Record<ConstellationId, ConstellationState>;

const defaultState: ConstellationState = {
  clickedCount: 0,
  completed: false,
  panelOpen: false,
};

const STORAGE_KEY = 'constellation-nav';

function loadStates(): States {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {
    info: { ...defaultState },
    projects: { ...defaultState },
    logs: { ...defaultState },
  };
}

export function useConstellationNav() {
  const [states, setStates] = useState<States>(loadStates);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  }, [states]);

  const handleStarClick = useCallback((id: ConstellationId, starIndex: number) => {
    setStates(prev => {
      const state = prev[id];

      // If completed and panel is open → reset (toggle off)
      if (state.completed && state.panelOpen) {
        return { ...prev, [id]: { ...defaultState } };
      }

      // If completed but panel closed → reopen
      if (state.completed) {
        return { ...prev, [id]: { ...state, panelOpen: true } };
      }

      // Must click stars in sequence
      if (starIndex !== state.clickedCount) return prev;

      const newCount = state.clickedCount + 1;
      const totalStars = CONSTELLATIONS.find(c => c.id === id)!.stars.length;
      const isComplete = newCount === totalStars;

      return {
        ...prev,
        [id]: {
          clickedCount: newCount,
          completed: isComplete,
          panelOpen: isComplete,
        },
      };
    });
  }, []);

  return { states, handleStarClick };
}