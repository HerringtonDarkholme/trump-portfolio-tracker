import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        panel: "#131a26",
        panel2: "#1a2335",
        border: "#243047",
        muted: "#8b97ad",
        buy: "#22c55e",
        sell: "#ef4444",
        accent: "#60a5fa",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
