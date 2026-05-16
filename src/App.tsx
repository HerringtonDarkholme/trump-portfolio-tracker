import { Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Stock from "./routes/Stock";
import Sector from "./routes/Sector";
import Day from "./routes/Day";
import SiteSearch from "./components/SiteSearch";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-panel/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="text-lg font-semibold tracking-tight hover:text-accent whitespace-nowrap">
            Trump Portfolio Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <SiteSearch />
            <span className="hidden lg:inline text-xs text-muted">
              2026 PTR · midpoint estimates
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stock/:ticker" element={<Stock />} />
          <Route path="/sector/:sector" element={<Sector />} />
          <Route path="/day/:date" element={<Day />} />
        </Routes>
      </main>
      <footer className="border-t border-border mt-8">
        <div className="max-w-[1400px] mx-auto px-6 py-4 text-[11px] text-muted">
          Based on public OGE filings. Recreational project, not financial advice.
        </div>
      </footer>
    </div>
  );
}
