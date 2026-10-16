import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0e0e14",
        panel: "#14141b",
        panel2: "#1b1b24",
        border: "#3b3524",
        accent: "#c9ae7a",
        accent2: "#af9256",
        success: "#5fd08f",
        warning: "#f0b44c",
        danger: "#ee7d73",
        cppem: "#c9ae7a",
        unicive: "#F5C518",
        colegio: "#5B8FE0",
      },
      fontFamily: {
        sans: ["var(--font-body)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Oxanium", "ui-sans-serif", "sans-serif"],
        ui: ["var(--font-ui)", "Rajdhani", "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(175,146,86,0.35), 0 14px 44px -12px rgba(175,146,86,0.30)",
        glowSoft: "0 0 0 1px rgba(175,146,86,0.22), 0 8px 30px -10px rgba(175,146,86,0.22)",
      },
    },
  },
  plugins: [],
};
export default config;
