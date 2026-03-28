import { useEffect, useRef, type RefObject } from 'react';
import type { MousePos } from '../../hooks/useParallax';

interface ConstellationsProps {
  mouseRef: RefObject<MousePos | null>;
}

const CONNECT_RADIUS = 120; // px — how close mouse must be to activate
const LINE_RADIUS = 150;    // px — max distance between stars to draw a line
const MAX_LINES = 8;        // cap drawn lines per frame

export function Constellations({ mouseRef }: ConstellationsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    let rafId: number;
    let starCache: { x: number; y: number }[] = [];
    let cacheTime = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const collectStars = () => {
      const now = Date.now();
      // Re-collect every 2s to account for parallax shifts
      if (now - cacheTime < 2000 && starCache.length > 0) return;
      cacheTime = now;

      const scene = document.getElementById('scene');
      if (!scene) return;

      const els = scene.querySelectorAll('[class*="star"]');
      starCache = [];
      els.forEach((el) => {
        // Only match actual star dots (small elements)
        const rect = el.getBoundingClientRect();
        if (rect.width > 5 || rect.height > 5) return;
        starCache.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;
      if (mouse) {
        const mx = mouse.x * canvas.width;
        const my = mouse.y * canvas.height;

        collectStars();

        // Find stars near the mouse
        const nearby = starCache.filter((s) => {
          const dx = s.x - mx;
          const dy = s.y - my;
          return Math.sqrt(dx * dx + dy * dy) < CONNECT_RADIUS;
        });

        // Draw lines between nearby pairs
        const isDark = !document.documentElement.hasAttribute('data-theme') ||
          document.documentElement.getAttribute('data-theme') !== 'light';

        let lineCount = 0;
        for (let i = 0; i < nearby.length && lineCount < MAX_LINES; i++) {
          for (let j = i + 1; j < nearby.length && lineCount < MAX_LINES; j++) {
            const a = nearby[i];
            const b = nearby[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < LINE_RADIUS) {
              const alpha = (1 - dist / LINE_RADIUS) * 0.4;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = isDark
                ? `rgba(180, 200, 255, ${alpha})`
                : `rgba(60, 60, 80, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
              lineCount++;
            }
          }
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [mouseRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}