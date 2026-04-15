"use client";

import { useEffect, useRef, useCallback } from "react";
import { animate } from "animejs";

// ── Tetromino shape definitions (classic Tetris) ─────────────────────
// Each shape is an array of [col, row] offsets from anchor
const TETROMINOS = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  J: [[1, 0], [1, 1], [1, 2], [0, 2]],
} as const;

type TetrominoType = keyof typeof TETROMINOS;

// ── Color palette (gold/amber variations matching brand) ─────────────
const BLOCK_COLORS = [
  { fill: "#EFD30B", shadow: "#C4AD09", highlight: "#F7E84E", glow: "rgba(239,211,11,0.5)" },   // bright gold
  { fill: "#D4B80A", shadow: "#A89208", highlight: "#E8D23A", glow: "rgba(212,184,10,0.4)" },   // deep gold
  { fill: "#F0DC3E", shadow: "#C9B832", highlight: "#F5E76E", glow: "rgba(240,220,62,0.45)" },  // light gold
  { fill: "#C4930A", shadow: "#9A7308", highlight: "#DDB030", glow: "rgba(196,147,10,0.35)" },  // amber
  { fill: "#F9F8F4", shadow: "#C8C7C3", highlight: "#FFFFFF", glow: "rgba(249,248,244,0.3)" },  // off-white accent
];

interface PlacedBlock {
  col: number;
  row: number;
  colorIdx: number;
  tetrominoId: number;
  delay: number;
}

// ── Pre-computed Tetris board layout ─────────────────────────────────
// This creates a partially-filled Tetris landscape that looks like mid-game
function generateBoardLayout(): PlacedBlock[] {
  const blocks: PlacedBlock[] = [];
  let id = 0;

  // Placement data: [type, anchorCol, anchorRow, colorIdx]
  const placements: [TetrominoType, number, number, number][] = [
    // Bottom layer — dense foundation
    ["I", 0, 13, 0],
    ["O", 4, 12, 1],
    ["T", 6, 13, 2],
    ["L", 9, 11, 3],
    ["Z", 11, 13, 0],
    ["I", 13, 13, 1],
    ["S", 17, 12, 2],
    ["J", 19, 11, 4],
    ["O", 21, 12, 0],

    // Second layer
    ["T", 1, 11, 2],
    ["S", 4, 10, 0],
    ["I", 6, 12, 3],
    ["Z", 10, 11, 1],
    ["L", 14, 11, 0],
    ["O", 16, 10, 4],
    ["T", 18, 13, 2],
    ["J", 21, 10, 1],

    // Third layer — building up
    ["O", 0, 10, 1],
    ["J", 2, 9, 0],
    ["Z", 5, 8, 3],
    ["T", 8, 10, 2],
    ["I", 11, 10, 0],
    ["S", 15, 9, 1],
    ["L", 19, 9, 3],

    // Mid section — creating peaks and valleys
    ["L", 1, 7, 3],
    ["T", 4, 7, 0],
    ["O", 7, 8, 1],
    ["I", 9, 9, 2],
    ["Z", 13, 8, 0],
    ["J", 17, 8, 4],
    ["S", 20, 8, 2],

    // Upper scattered pieces — "falling" look
    ["T", 3, 5, 0],
    ["O", 8, 6, 3],
    ["I", 12, 6, 1],
    ["L", 16, 6, 0],
    ["S", 19, 6, 2],

    // Floating pieces near top — actively falling
    ["Z", 2, 3, 1],
    ["J", 7, 4, 0],
    ["T", 14, 4, 3],
    ["O", 20, 4, 1],

    // Top scattered singles-style pieces
    ["I", 5, 1, 0],
    ["L", 11, 2, 2],
    ["T", 18, 2, 0],
  ];

  placements.forEach(([type, anchorCol, anchorRow, colorIdx], placementIdx) => {
    const shape = TETROMINOS[type];
    shape.forEach(([dc, dr]) => {
      blocks.push({
        col: anchorCol + dc,
        row: anchorRow + dr,
        colorIdx,
        tetrominoId: id,
        // Bottom blocks animate first (higher row = earlier), with stagger per tetromino
        delay: (14 - anchorRow) * 120 + placementIdx * 35,
      });
    });
    id++;
  });

  return blocks;
}

const BOARD_COLS = 24;
const BOARD_ROWS = 15;
const CELL_SIZE = 28;
const GAP = 2;

const boardBlocks = generateBoardLayout();

export function TetrisCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const runAnimation = useCallback(() => {
    if (!containerRef.current || hasAnimated.current) return;
    hasAnimated.current = true;

    const blockEls = containerRef.current.querySelectorAll<HTMLElement>("[data-tetris-block]");

    // Phase 1: Blocks fall into place from above
    const blockArray = Array.from(blockEls);

    animate(blockArray, {
      translateY: ["-400px", "0px"],
      opacity: [0, 1],
      scale: [0.3, 1],
      delay: (_el: HTMLElement, i: number) => {
        const block = boardBlocks[i];
        return block ? block.delay : i * 30;
      },
      duration: 800,
      ease: "outBounce",
      onComplete: () => {
        // Phase 2: Subtle idle pulse on random blocks
        const randomBlocks = blockArray
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(blockArray.length * 0.3));

        animate(randomBlocks, {
          boxShadow: [
            "0 0 8px rgba(239,211,11,0.2)",
            "0 0 20px rgba(239,211,11,0.6)",
            "0 0 8px rgba(239,211,11,0.2)",
          ],
          duration: 2500,
          ease: "inOutSine",
          loop: true,
          delay: (_el: HTMLElement, i: number) => i * 200,
        });
      },
    });
  }, []);

  useEffect(() => {
    // Small delay so the DOM is painted first
    const timer = setTimeout(runAnimation, 300);
    return () => clearTimeout(timer);
  }, [runAnimation]);

  const totalWidth = BOARD_COLS * (CELL_SIZE + GAP);
  const totalHeight = BOARD_ROWS * (CELL_SIZE + GAP);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Fade edges so blocks blend into the dark background */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,#1A1A19_75%)]" />

      {/* Grid lines (subtle) */}
      <div
        className="absolute opacity-[0.06]"
        style={{
          width: totalWidth,
          height: totalHeight,
          backgroundImage:
            "linear-gradient(to right, rgba(249,248,244,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(249,248,244,0.3) 1px, transparent 1px)",
          backgroundSize: `${CELL_SIZE + GAP}px ${CELL_SIZE + GAP}px`,
        }}
      />

      {/* Block container */}
      <div
        ref={containerRef}
        className="relative"
        style={{ width: totalWidth, height: totalHeight }}
      >
        {boardBlocks.map((block, i) => {
          const color = BLOCK_COLORS[block.colorIdx];
          const x = block.col * (CELL_SIZE + GAP);
          const y = block.row * (CELL_SIZE + GAP);

          return (
            <div
              key={`${block.col}-${block.row}-${i}`}
              data-tetris-block
              className="absolute"
              style={{
                left: x,
                top: y,
                width: CELL_SIZE,
                height: CELL_SIZE,
                opacity: 0, // start hidden, anime.js reveals
              }}
            >
              {/* Main block face */}
              <div
                className="absolute inset-0 rounded-[3px]"
                style={{
                  backgroundColor: color.fill,
                  boxShadow: `0 0 8px ${color.glow}, inset 0 1px 0 ${color.highlight}`,
                }}
              />
              {/* Top highlight bevel */}
              <div
                className="absolute inset-x-0 top-0 h-[5px] rounded-t-[3px] opacity-60"
                style={{
                  background: `linear-gradient(to bottom, ${color.highlight}, transparent)`,
                }}
              />
              {/* Bottom shadow bevel */}
              <div
                className="absolute inset-x-0 bottom-0 h-[5px] rounded-b-[3px] opacity-50"
                style={{
                  background: `linear-gradient(to top, ${color.shadow}, transparent)`,
                }}
              />
              {/* Left highlight */}
              <div
                className="absolute inset-y-0 left-0 w-[4px] rounded-l-[3px] opacity-40"
                style={{
                  background: `linear-gradient(to right, ${color.highlight}, transparent)`,
                }}
              />
              {/* Right shadow */}
              <div
                className="absolute inset-y-0 right-0 w-[4px] rounded-r-[3px] opacity-40"
                style={{
                  background: `linear-gradient(to left, ${color.shadow}, transparent)`,
                }}
              />
              {/* Inner pixel detail — gives that Minecraft/voxel texture */}
              <div
                className="absolute left-[3px] top-[3px] h-[6px] w-[6px] rounded-[1px] opacity-25"
                style={{ backgroundColor: color.highlight }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
