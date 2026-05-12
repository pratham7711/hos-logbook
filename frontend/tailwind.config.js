/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: {
          50:  "#f6f7f9",
          100: "#eceef2",
          200: "#d4d8e1",
          300: "#aeb6c4",
          400: "#7d8aa0",
          500: "#586780",
          600: "#3f4d65",
          700: "#2f3a4d",
          800: "#1e2533",
          900: "#0f1320",
          950: "#070a13",
        },
        accent: {
          DEFAULT: "#5b6cff",
          fg: "#ffffff",
        },
        amber: {
          DEFAULT: "#f59e0b",
        },
        danger: {
          DEFAULT: "#ef4444",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(15,19,32,0.06)",
        glow: "0 0 0 6px rgba(91,108,255,0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.32s ease-out",
      },
    },
  },
  plugins: [],
};
