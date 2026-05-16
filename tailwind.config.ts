import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f7f2e7",         // soft cream, between near-white and warm cream
        panel: "#fdfaf0",      // pale cream card
        panel2: "#ede5cc",     // sand for hover / active
        border: "#ddd2b0",     // tan border
        muted: "#737060",      // muted warm gray
        buy: "#3a7a3a",        // forest green
        sell: "#a52a2a",       // brick red
        accent: "#d1b371",     // brass-gold tint (rgb 209,179,113)
        accent2: "#a88a4d",    // deeper gold for hover
        ink: "#24201a",        // warm dark
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "Cormorant Garamond",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
