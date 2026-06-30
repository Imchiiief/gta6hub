/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        midnight: "#010310",
        "midnight-50": "#0a0e1f",
        "midnight-100": "#0d1128",
        "midnight-200": "#111630",
        slate: "#0B0F19",
        neon: "#23A9BD",
        "neon-dim": "#1a7f90",
        "neon-bright": "#2ec8df",
        "neon-glow": "rgba(35,169,189,0.15)",
        "neon-border": "rgba(35,169,189,0.25)",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(35,169,189,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(35,169,189,0.04) 1px, transparent 1px)",
        "hero-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(35,169,189,0.12) 0%, transparent 70%)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      boxShadow: {
        neon: "0 0 20px rgba(35,169,189,0.3), 0 0 60px rgba(35,169,189,0.1)",
        "neon-sm": "0 0 10px rgba(35,169,189,0.2)",
        "card": "0 1px 0 rgba(35,169,189,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
      },
      animation: {
        "pulse-neon": "pulseNeon 3s ease-in-out infinite",
        "fade-up": "fadeUp 0.6s ease both",
      },
      keyframes: {
        pulseNeon: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
