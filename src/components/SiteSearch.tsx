import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { dataset } from "../lib/dataset";
import CompanyLogo from "./CompanyLogo";

type Hit =
  | { kind: "stock"; ticker: string; name: string; sector: string; score: number }
  | { kind: "sector"; sector: string; tickerCount: number; score: number };

function buildHits(query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Hit[] = [];

  // Sectors
  for (const sec of Object.values(dataset.sectors)) {
    const s = sec.sector.toLowerCase();
    let score = 0;
    if (s === q) score = 1000;
    else if (s.startsWith(q)) score = 700;
    else if (s.includes(q)) score = 400;
    if (score > 0) {
      out.push({ kind: "sector", sector: sec.sector, tickerCount: sec.tickers.length, score });
    }
  }

  // Stocks
  for (const stock of Object.values(dataset.stocks)) {
    const t = stock.ticker.toLowerCase();
    const n = stock.name.toLowerCase();
    let score = 0;
    if (t === q) score = 2000;
    else if (t.startsWith(q)) score = 900;
    else if (n === q) score = 950;
    else if (n.startsWith(q)) score = 800;
    else if (t.includes(q)) score = 500;
    else if (n.includes(q)) score = 300;
    if (score > 0) {
      // Bonus for higher volume (so big names rank above tiny ones with same match)
      const vol = stock.totalBuy + stock.totalSell;
      const volBonus = Math.min(100, Math.log10(1 + vol) * 8);
      out.push({
        kind: "stock", ticker: stock.ticker, name: stock.name, sector: stock.sector,
        score: score + volBonus,
      });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 8);
}

export default function SiteSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => buildHits(query), [query]);

  useEffect(() => { setFocusIdx(0); }, [query]);

  // Global keyboard shortcut: / opens search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside → close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    if (hit.kind === "stock") navigate(`/stock/${encodeURIComponent(hit.ticker)}`);
    else navigate(`/sector/${encodeURIComponent(hit.sector)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[focusIdx]) go(hits[focusIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xs sm:w-72 min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search ticker, name…"
          className="w-full bg-panel2 border border-border rounded-md pl-8 pr-8 sm:pr-9 py-1.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <kbd className="hidden sm:inline absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted bg-bg border border-border rounded px-1.5 py-0.5 pointer-events-none">/</kbd>
      </div>

      <AnimatePresence>
        {open && query && (
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 mt-1 bg-panel border border-border rounded-md shadow-2xl overflow-hidden z-50 origin-top"
          >
            {hits.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted text-center">No matches for "{query}"</div>
            ) : (
              <ul>
                {hits.map((h, i) => {
                  const active = i === focusIdx;
                  const cls = "px-3 py-2 cursor-pointer flex items-center justify-between gap-3 " +
                    (active ? "bg-accent/15" : "hover:bg-panel2/60");
                  return (
                    <li key={`${h.kind}-${i}`} onMouseEnter={() => setFocusIdx(i)} onClick={() => go(h)} className={cls}>
                      {h.kind === "stock" ? (
                        <>
                          <CompanyLogo
                            ticker={h.ticker}
                            alt=""
                            className="w-7 h-7 object-contain bg-bg rounded-sm border border-border p-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-accent text-sm">{h.ticker}</div>
                            <div className="text-xs text-muted truncate">{h.name}</div>
                          </div>
                          <span className="text-[11px] text-muted px-1.5 py-0.5 rounded bg-panel2 border border-border whitespace-nowrap">
                            {h.sector}
                          </span>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="text-sm text-ink">{h.sector}</div>
                            <div className="text-xs text-muted">{h.tickerCount} tickers</div>
                          </div>
                          <span className="text-[11px] text-muted px-1.5 py-0.5 rounded bg-panel2 border border-border">
                            sector
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted flex justify-between">
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>{hits.length} match{hits.length === 1 ? "" : "es"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
