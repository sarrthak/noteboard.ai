"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Constellation Background Component
function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const MAX_STARS = 120;
    const CONNECTION_DIST = 150;
    const CELL_SIZE = CONNECTION_DIST;
    const CONNECTION_INTERVAL = 3; // recompute connections every N frames
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

    // Spatial grid for O(n) nearby-star lookups
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

        // Check own cell + 4 neighbours (right, below-left, below, below-right)
        // to avoid duplicate pairs
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

      // Recompute connections every N frames
      if (frameCount % CONNECTION_INTERVAL === 0) {
        computeConnections();
      }
      frameCount++;

      // Draw cached connections
      ctx.strokeStyle = "rgba(249, 248, 244, 0.05)";
      ctx.lineWidth = 0.5;
      for (const [i, j] of cachedConnections) {
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
        ctx.stroke();
      }

      // Draw and update stars
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else if (result?.ok) {
        router.push("/workspace");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ConstellationBackground />

      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            noteboard<span className="text-primary">.ai</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Your intelligent project workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="border border-foreground/10 bg-background/80 backdrop-blur-sm p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-4 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                error={!!error}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                error={!!error}
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              size="lg"
              isLoading={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <a
                href="/register"
                className="text-primary hover:underline font-medium"
              >
                Create one
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © 2026 noteboard.ai. All rights reserved.
        </p>
      </div>
    </div>
  );
}
