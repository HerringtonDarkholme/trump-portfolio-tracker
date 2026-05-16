import { Routes, Route, Link } from "react-router-dom";
import Home from "./routes/Home";
import Stock from "./routes/Stock";
import Sector from "./routes/Sector";
import Day from "./routes/Day";
import Sitemap from "./routes/Sitemap";
import SiteSearch from "./components/SiteSearch";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between gap-6">
          <Link
            to="/"
            className="bg-ink text-bg px-5 py-2.5 hover:bg-accent2 transition-colors font-serif"
          >
            <div className="text-2xl tracking-[0.18em] font-medium leading-none">TRUMP</div>
            <div className="text-[9px] tracking-[0.22em] text-accent mt-0.5">PORTFOLIO DASHBOARD</div>
          </Link>
          <div className="flex items-center gap-6">
            <SiteSearch />
            <span className="hidden lg:inline text-[10px] tracking-[0.18em] uppercase text-muted">
              2026 PTR · Midpoint Estimates
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
          <Route path="/sitemap" element={<Sitemap />} />
        </Routes>
      </main>
      <footer className="border-t border-border mt-12 bg-panel2/40">
        <div className="max-w-[1400px] mx-auto px-8 py-5 text-[10px] tracking-[0.12em] uppercase text-muted flex items-center justify-between gap-3 flex-wrap">
          <span>Based on public OGE filings · Recreational project · Not financial advice</span>
          <Link to="/sitemap" className="hover:text-accent2">Sitemap</Link>
        </div>
      </footer>
    </div>
  );
}
