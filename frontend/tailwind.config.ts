import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          background: "#000000",
          neon: "#39FF14",
        },
      },
      boxShadow: {
        "neon-green": "0 0 20px rgba(57, 255, 20, 0.5)",
      },
      backdropBlur: {
        12: "12px",
      },
      fontFamily: {
        space: ["var(--font-space-grotesk)"],
        inter: ["var(--font-inter)"],
        jetbrains: ["var(--font-jetbrains-mono)"],
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        ticker: "ticker 30s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
