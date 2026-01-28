import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        background: "#1A1A19",
        foreground: "#F9F8F4",
        primary: {
          DEFAULT: "#EFD30B",
          hover: "#D4BC0A",
        },
        muted: {
          DEFAULT: "#2A2A29",
          foreground: "#A0A0A0",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#F9F8F4",
        },
      },
    },
  },
  plugins: [],
};
export default config;
