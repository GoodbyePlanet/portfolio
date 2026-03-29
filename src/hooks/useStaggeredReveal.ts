import { useState, useEffect } from 'react';

export function useStaggeredReveal(count: number, baseDelay: number, stagger: number, enabled = true) {
  const [visible, setVisible] = useState<boolean[]>(() => Array(count).fill(false));

  useEffect(() => {
    if (!enabled) {
      setVisible(Array(count).fill(false));
      return;
    }

    const timeouts: number[] = [];
    for (let i = 0; i < count; i++) {
      timeouts.push(
        window.setTimeout(() => {
          setVisible(prev => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, baseDelay + i * stagger)
      );
    }
    return () => timeouts.forEach(clearTimeout);
  }, [count, baseDelay, stagger, enabled]);

  return visible;
}
