# Frontend Design & UI Engineering Skills

## 1. Brand Aesthetic: "Mission Control / The Forge"

You are an expert Frontend Engineer and UI/UX Designer. When generating or modifying React components, you MUST adhere to the following design system:

- **Vibe:** Deep-tech, Mission Control, cinematic, high-contrast SaaS.
- **Background (The Void):** `#1A1A19` (Deep Charcoal). Do NOT use pure black except for terminal/code windows.
- **Primary Accent (The Energy):** `#EFD30B` (Mustard Gold). Use for active states, primary buttons, borders of active cards, and glowing elements.
- **Text (The Structure):** `#F9F8F4` (Off-white). Use for primary text. Use opacity (e.g., `text-white/60`) for secondary text.
- **Borders:** Use thin, subtle borders (`border border-white/10`) to separate panes.

## 2. Tailwind CSS Guidelines

- **Dark Mode Default:** Assume the entire application is in dark mode.
- **Glassmorphism:** Use `backdrop-blur-md bg-black/40` for floating elements, modals, or sticky headers to give depth.
- **Monospace:** Use `font-mono` for anything related to code, logs, agent thoughts, or IDs.
- **Glow Effects:** When an AI agent is active, use Tailwind shadow classes to create a gold glow: `shadow-[0_0_15px_rgba(239,211,11,0.3)]`.

## 3. Motion & Animation (Framer Motion + anime.js)

Never let UI elements snap instantly. Use `framer-motion` for state changes.

- **Presence:** Wrap conditionally rendered elements in `<AnimatePresence>`.
- **The "Pulse":** When an agent is "thinking" or waiting for human approval, the active UI element must pulse.
  Example: `animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}`
- **anime.js (v4):** Use for complex staggered/sequenced DOM animations (e.g., landing page hero). Import as `import { animate } from "animejs"` (named export, NOT default). Use `ease:` instead of `easing:`, `onComplete:` instead of `complete:`. Good for Tetris/pixel-art block drops, bounce-in staggers, and looping glow pulses.

## 4. Next.js 14 Best Practices

- **Server vs Client:** Default to Server Components. ONLY add `"use client"` when the component uses React hooks (useState, useEffect), Zustand stores, or WebSockets.
- **Lucide Icons:** Always use `lucide-react` for icons. Keep stroke width clean (`strokeWidth={1.5}`).

## 5. UI Component Hierarchy

- Prioritize high-density information layouts. This is a tool for Senior Developers, not a consumer app.
- Avoid excessive padding; keep things compact but breathable.
