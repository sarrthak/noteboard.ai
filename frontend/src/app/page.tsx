"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Github, Mic, Network, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TetrisCanvas } from "@/components/hero/tetris-canvas";

const sectionAnimation = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const },
};

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

const features: Feature[] = [
  {
    title: "Huddle",
    description:
      "Voice-to-Intent. Speak your requirements, and our AI maps them to a living Knowledge Graph.",
    icon: Mic,
  },
  {
    title: "Design",
    description:
      "Auto-Architecture. Generate executable Mermaid.js HLDs and LLDs instantly from constraints.",
    icon: Network,
  },
  {
    title: "Dev",
    description:
      "Agentic Execution. LangGraph state machines write code, halting at strict checkpoints for your approval.",
    icon: Terminal,
  },
];

const stackNames = [
  "FastAPI",
  "Next.js 14",
  "Neo4j GraphDB",
  "LangGraph",
  "OpenRouter",
  "Postgres",
  "Docker",
];



export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#1A1A19] text-[#F9F8F4]">
      <SiteHeader />
      <HeroSection />
      <ProductSection />
      <TechStackSection />
      <PhilosophySection />
      <FooterSection />

      <style jsx global>{`
        @keyframes noteboard-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#1A1A19]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 sm:h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base sm:text-lg font-bold tracking-tight text-[#F9F8F4]">
          noteboard.ai
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex rounded-md border border-transparent px-4 py-2 text-sm font-medium text-[#F9F8F4] transition hover:border-white/20 hover:bg-white/5"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-[#EFD30B] bg-[#EFD30B] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#1A1A19] transition hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(239,211,11,0.35)]"
          >
            Start Building
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 sm:px-6 pb-16 pt-28 sm:pb-32 sm:pt-44 min-h-[85vh] sm:min-h-[90vh] flex items-center">
      {/* Radial ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,211,11,0.08),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(249,248,244,0.05),transparent_42%)]" />

      {/* Tetris / Minecraft pixel-art block canvas */}
      <TetrisCanvas />

      {/* Content overlay */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 0.85, delay: 1.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 mx-auto w-full max-w-5xl"
      >
        <div className="mx-auto flex max-w-fit items-center gap-2 sm:gap-3 rounded-full border border-white/15 bg-black/40 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/60 backdrop-blur-lg">
          <BlockLogo />
          <span className="hidden xs:inline">Solo Architect Command Deck</span>
          <span className="xs:hidden">Command Deck</span>
        </div>

        <h1 className="mx-auto mt-6 sm:mt-8 max-w-4xl text-balance text-center text-3xl font-semibold leading-tight text-[#F9F8F4] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-4xl md:text-5xl lg:text-6xl">
          Orchestrate the Chaos of Software Development.
        </h1>

        <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-balance text-center text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] sm:text-base md:text-lg">
          From voice intent to executable architecture. You direct the AI; the AI writes the
          code.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row">
          <Link
            href="/register"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-[#EFD30B] bg-[#EFD30B] px-5 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-[#1A1A19] transition hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(239,211,11,0.35)]"
          >
            Initialize Workspace
            <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
          </Link>
          <Link
            href="https://docs.noteboard.ai"
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto hidden sm:inline-flex items-center gap-2 rounded-md border border-white/30 bg-black/30 px-6 py-3 text-sm font-medium text-[#F9F8F4] backdrop-blur-sm transition hover:border-white/60 hover:bg-white/5"
          >
            Read the Docs
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function ProductSection() {
  return (
    <motion.section {...sectionAnimation} className="px-4 sm:px-6 py-10 sm:py-14 md:py-16" id="product">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-[#F9F8F4] sm:text-3xl md:text-4xl">
          The Autonomous Software Factory
        </h2>

        <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-white/5 bg-black/20 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#EFD30B]/50 hover:shadow-[0_0_30px_rgba(239,211,11,0.18)]"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#EFD30B] transition group-hover:border-[#EFD30B]/40 group-hover:bg-[#EFD30B]/10">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="text-xl font-semibold text-[#F9F8F4]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function TechStackSection() {
  const marqueeItems = [...stackNames, ...stackNames];

  return (
    <motion.section {...sectionAnimation} className="px-4 sm:px-6 py-10 sm:py-12 md:py-14" id="tech-stack">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm uppercase tracking-[0.25em] text-white/50">
          Built on Enterprise Deep Tech
        </p>

        <div className="group relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#1A1A19] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#1A1A19] to-transparent" />

          <div
            className="flex w-max items-center gap-6 px-6 py-5 group-hover:[animation-play-state:paused]"
            style={{ animation: "noteboard-marquee 22s linear infinite" }}
          >
            {marqueeItems.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="whitespace-nowrap text-sm tracking-wide text-white/40 transition-colors hover:text-white"
              >
                {item}
                {index !== marqueeItems.length - 1 && <span className="mx-6 text-white/20">•</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PhilosophySection() {
  return (
    <motion.section {...sectionAnimation} className="px-4 sm:px-6 py-12 sm:py-16 md:py-20" id="philosophy">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <h2 className="text-balance text-2xl font-semibold leading-tight text-[#F9F8F4] sm:text-3xl md:text-4xl">
            Elevation, Not Replacement.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
            The industry is trying to replace developers with brute-force autonomous coders. We
            believe the future belongs to the Solo Architect. noteboard.ai automates the assembly
            line so you can focus on business value. 1 Person. 1 Product.
          </p>
        </div>

        <div className="relative mx-auto h-[260px] sm:h-[320px] w-full max-w-[460px] rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md lg:flex-1">
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_28%_20%,rgba(239,211,11,0.2),transparent_45%),radial-gradient(circle_at_78%_78%,rgba(249,248,244,0.09),transparent_55%)]" />

          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#EFD30B]/60 bg-[#EFD30B]/20 shadow-[0_0_35px_rgba(239,211,11,0.45)]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F9F8F4]">
            Director
          </div>

          <div className="absolute left-[28%] top-[24%] h-px w-[128px] -rotate-[145deg] bg-gradient-to-r from-[#EFD30B]/45 to-white/5" />
          <div className="absolute left-[51%] top-[24%] h-px w-[122px] rotate-[145deg] bg-gradient-to-r from-[#EFD30B]/45 to-white/5" />
          <div className="absolute left-[20%] top-[51%] h-px w-[112px] -rotate-[182deg] bg-gradient-to-r from-[#EFD30B]/40 to-white/10" />
          <div className="absolute left-[61%] top-[51%] h-px w-[106px] rotate-[1deg] bg-gradient-to-r from-[#EFD30B]/40 to-white/10" />
          <div className="absolute left-[28%] top-[76%] h-px w-[128px] rotate-[145deg] bg-gradient-to-r from-[#EFD30B]/45 to-white/5" />
          <div className="absolute left-[52%] top-[76%] h-px w-[118px] -rotate-[145deg] bg-gradient-to-r from-[#EFD30B]/45 to-white/5" />

          <CommandNode className="left-[12%] top-[14%]" />
          <CommandNode className="left-[73%] top-[12%]" />
          <CommandNode className="left-[5%] top-[45%]" />
          <CommandNode className="left-[83%] top-[45%]" />
          <CommandNode className="left-[15%] top-[78%]" />
          <CommandNode className="left-[71%] top-[80%]" />
        </div>
      </div>
    </motion.section>
  );
}

function FooterSection() {
  return (
    <section className="px-4 sm:px-6 pb-8 pt-10">
      <motion.div
        {...sectionAnimation}
        className="mx-auto w-full max-w-5xl rounded-3xl border border-[#EFD30B]/30 bg-gradient-to-b from-[#EFD30B]/10 to-black/20 px-5 sm:px-8 py-10 sm:py-14 text-center"
      >
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-[#F9F8F4] sm:text-3xl md:text-5xl">
          Ready to become a Director?
        </h2>
        <Link
          href="/register"
          className="mx-auto mt-8 inline-flex items-center justify-center gap-2 rounded-md border border-[#EFD30B] bg-[#EFD30B] px-8 py-4 text-base font-semibold text-[#1A1A19] transition hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(239,211,11,0.35)]"
        >
          Deploy Your First Agent
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </motion.div>

      <footer className="mx-auto mt-12 flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row">
        <p>© 2026 noteboard.ai</p>
        <div className="flex items-center gap-6">
          <a href="#" className="transition hover:text-white">
            Privacy
          </a>
          <a href="#" className="transition hover:text-white">
            Terms
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-white"
          >
            <Github className="h-4 w-4" strokeWidth={1.8} />
            GitHub
          </a>
        </div>
      </footer>
    </section>
  );
}



function BlockLogo() {
  const blocks = [
    { x: 0, y: 0, color: "#EFD30B" },
    { x: 1, y: 0, color: "#EFD30B" },
    { x: 1, y: 1, color: "#EFD30B" },
    { x: 2, y: 1, color: "rgba(249,248,244,0.85)" },
    { x: 2, y: 2, color: "rgba(249,248,244,0.85)" },
    { x: 3, y: 2, color: "#EFD30B" },
  ];

  return (
    <div className="relative h-6 w-8">
      {blocks.map((block, index) => (
        <span
          key={`${block.x}-${block.y}-${index}`}
          className="absolute h-[10px] w-[10px] rounded-[2px] border border-black/20"
          style={{
            left: `${block.x * 7}px`,
            top: `${block.y * 7}px`,
            backgroundColor: block.color,
            boxShadow:
              block.color === "#EFD30B"
                ? "0 0 10px rgba(239,211,11,0.45)"
                : "0 0 8px rgba(249,248,244,0.35)",
          }}
        />
      ))}
    </div>
  );
}

function CommandNode({ className }: { className: string }) {
  return (
    <div
      className={`absolute h-9 w-9 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm ${className}`}
    />
  );
}
