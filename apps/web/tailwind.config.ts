import type { Config } from "tailwindcss";

// Tokens mappés 1:1 sur les variables CSS de src/styles/tokens.css, elles-mêmes
// reprises telles quelles de maquette-app-education-benin.html (source de vérité design).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        primary: "var(--primary)",
        "primary-deep": "var(--primary-deep)",
        "primary-tint": "var(--primary-tint)",
        accent: "var(--accent)",
        "accent-tint": "var(--accent-tint)",
        alert: "var(--alert)",
        "alert-tint": "var(--alert-tint)",
        surface: "var(--surface)",
        line: "var(--line)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        soft: "0 20px 40px -28px rgba(19, 33, 25, .35)",
        lift: "0 30px 60px -30px rgba(19, 33, 25, .35)",
      },
      fontFamily: {
        display: ['"Baloo 2"', "sans-serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
