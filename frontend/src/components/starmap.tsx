"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

export function Starmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let stars: Star[] = [];

    const MAX_STARS = 120;
    const CONNECTION_DIST = 150;
    const CELL_SIZE = CONNECTION_DIST;
    const CONNECTION_INTERVAL = 3;
    let frameCount = 0;
    let cachedConnections: [number, number][] = [];

    const initStars = () => {
      const numStars = Math.min(
        Math.floor((canvas.width * canvas.height) / 15000),
        MAX_STARS
      );

      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 1.5 + 0.5,
        });
      }

      cachedConnections = [];
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const computeConnections = () => {
      const cols = Math.ceil(canvas.width / CELL_SIZE) + 1;
      const grid = new Map<number, number[]>();

      for (let i = 0; i < stars.length; i++) {
        const cx = Math.floor(stars[i].x / CELL_SIZE);
        const cy = Math.floor(stars[i].y / CELL_SIZE);
        const key = cy * cols + cx;
        const bucket = grid.get(key);

        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      }

      const pairs: [number, number][] = [];
      const distSq = CONNECTION_DIST * CONNECTION_DIST;

      for (let i = 0; i < stars.length; i++) {
        const cx = Math.floor(stars[i].x / CELL_SIZE);
        const cy = Math.floor(stars[i].y / CELL_SIZE);

        const neighbours = [
          cy * cols + cx,
          cy * cols + (cx + 1),
          (cy + 1) * cols + (cx - 1),
          (cy + 1) * cols + cx,
          (cy + 1) * cols + (cx + 1),
        ];

        for (const nk of neighbours) {
          const bucket = grid.get(nk);
          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i) continue;

            const dx = stars[i].x - stars[j].x;
            const dy = stars[i].y - stars[j].y;
            if (dx * dx + dy * dy < distSq) {
              pairs.push([i, j]);
            }
          }
        }
      }

      cachedConnections = pairs;
    };

    const draw = () => {
      ctx.fillStyle = "#1A1A19";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (frameCount % CONNECTION_INTERVAL === 0) {
        computeConnections();
      }
      frameCount++;

      ctx.strokeStyle = "rgba(249, 248, 244, 0.05)";
      ctx.lineWidth = 0.5;
      for (const [i, j] of cachedConnections) {
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
        ctx.stroke();
      }

      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(249, 248, 244, 0.6)";
        ctx.fill();

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < 0 || star.x > canvas.width) star.vx *= -1;
        if (star.y < 0 || star.y > canvas.height) star.vy *= -1;
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: "#1A1A19" }}
    />
  );
}