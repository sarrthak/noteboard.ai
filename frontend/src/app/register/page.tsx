"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

function parseRegisterError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return "An unexpected error occurred. Please try again.";
  }

  const status = err.response?.status;
  const detail = err.response?.data?.detail;

  if (status === 400 || status === 422) {
    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item: { msg?: string }) => item?.msg)
        .filter(Boolean)
        .join(" ");
      return messages || "Please check your inputs and try again.";
    }

    return "Please check your inputs and try again.";
  }

  return "Could not create account right now. Please try again.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) {
        setError("API URL is not configured. Please contact support.");
        return;
      }

      await axios.post(`${baseUrl}/auth/register`, {
        email,
        password,
        full_name: fullName,
      });

      router.push("/login?registered=1");
    } catch (err) {
      setError(parseRegisterError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ConstellationBackground />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            noteboard<span className="text-primary">.ai</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Build your mission control account
          </p>
        </div>

        <div className="border border-foreground/10 bg-background/80 backdrop-blur-sm p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Create your account
          </h2>

          {error && (
            <div className="mb-4 p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Full Name
              </label>
              <Input
                id="full_name"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                error={!!error}
              />
            </div>

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
                autoComplete="new-password"
                error={!!error}
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-6 bg-[#EFD30B] text-[#1A1A19] hover:bg-[#EFD30B]/90"
              size="lg"
              isLoading={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          © 2026 noteboard.ai. All rights reserved.
        </p>
      </div>
    </div>
  );
}