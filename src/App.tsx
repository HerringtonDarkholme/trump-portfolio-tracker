import { Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Stock from "./routes/Stock";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-panel/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-baseline justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight hover:text-accent">
            Trump Portfolio Dashboard
          </Link>
          <span className="text-xs text-muted">
            2026 periodic transaction reports · midpoint estimates from disclosed ranges
          </span>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stock/:ticker" element={<Stock />} />
        </Routes>
      </main>
    </div>
  );
}
