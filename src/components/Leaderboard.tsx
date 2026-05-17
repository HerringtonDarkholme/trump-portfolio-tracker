import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$ } from "../lib/format";
import SnapshotSelect from "./SnapshotSelect";
import { DEFAULT_SNAPSHOT_DATE } from "../lib/snapshot";
import portfolioYieldJson from "../data/portfolio-yield.json";
import type { PortfolioYield as PortfolioYieldT } from "../types";

const yieldData = portfolioYieldJson as unknown as PortfolioYieldT;

type Tab = "netBuy" | "netSell" | "volume" | "active" | "pnlBest" | "pnlWorst";
const TABS: { id: Tab; label: string }[] = [
  { id: "netBuy", label: "Biggest net buys" },
  { id: "netSell", label: "Biggest net sells" },
  { id: "volume", label: "Highest volume" },
  { id: "active", label: "Most active" },
  { id: "pnlBest", label: "Most profitable" },
  { id: "pnlWorst", label: "Least profitable" },
];

const PNL_TABS: Tab[] = ["pnlBest", "pnlWorst"];

type Row = {
  ticker: string;
  name: string;
  sector: string;
  totalBuy: number;
  totalSell: number;
  net: number;
  txCount: number;
  // Only set for P&L tabs.
  estPnL?: number;
};

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>("netBuy");
  const [sector, setSector] = useState<string>("All");
  const [snapshotPick, setSnapshotPick] = useState<string>(DEFAULT_SNAPSHOT_DATE);
  const reduceMotion = useReducedMotion();
  const isPnl = PNL_TABS.includes(tab);

  const sectors = useMemo(
    () => ["All", ...Object.keys(dataset.sectors).sort()],
    []
  );

  const snap = useMemo(
    () => yieldData.snapshots.find((s) => s.date === snapshotPick) ?? null,
    [snapshotPick]
  );

  const rows = useMemo<Row[]>(() => {
    const all = Object.values(dataset.stocks);
    const filtered = sector === "All" ? all : all.filter((s) => s.sector === sector);

    if (isPnl) {
      // Join with per-ticker P&L from portfolio-yield snapshot. Tickers without
      // price data (no entry in snap.stocks) are excluded.
      if (!snap) return [];
      const joined: Row[] = [];
      for (const s of filtered) {
        const p = snap.stocks[s.ticker];
        if (!p) continue;
        joined.push({
          ticker: s.ticker,
          name: s.name,
          sector: s.sector,
          totalBuy: s.totalBuy,
          totalSell: s.totalSell,
          net: s.net,
          txCount: s.txCount,
          estPnL: p.estPnL,
        });
      }
      joined.sort((a, b) =>
        tab === "pnlBest" ? (b.estPnL ?? 0) - (a.estPnL ?? 0) : (a.estPnL ?? 0) - (b.estPnL ?? 0)
      );
      return joined.slice(0, 25);
    }

    // Non-P&L tabs use the existing midpoint sums on the dataset.
    let list: Row[] = filtered.map((s) => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      totalBuy: s.totalBuy,
      totalSell: s.totalSell,
      net: s.net,
      txCount: s.txCount,
    }));
    switch (tab) {
      case "netBuy":
        list = list.filter((s) => s.net > 0).sort((a, b) => b.net - a.net);
        break;
      case "netSell":
        list = list.filter((s) => s.net < 0).sort((a, b) => a.net - b.net);
        break;
      case "volume":
        list = list.sort((a, b) => (b.totalBuy + b.totalSell) - (a.totalBuy + a.totalSell));
        break;
      case "active":
        list = list.sort((a, b) => b.txCount - a.txCount);
        break;
    }
    return list.slice(0, 25);
  }, [tab, sector, snap, isPnl]);

  return (
    <section className="bg-panel border border-border p-3 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-serif text-xl sm:text-2xl text-ink">
          Leaderboard
        </h2>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {isPnl && (
            <div className="flex items-center gap-2">
              <span className="text-muted text-[11px] tracking-[0.15em] uppercase">As of:</span>
              <SnapshotSelect value={snapshotPick} onChange={setSnapshotPick} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-muted text-[11px] tracking-[0.15em] uppercase">Sector:</label>
            <select
              className="bg-bg border border-ink px-2 py-1 text-ink max-w-[160px]"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="-mx-3 sm:mx-0 mb-4 overflow-x-auto">
        <div className="inline-flex border border-ink mx-3 sm:mx-0">
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "relative px-2.5 sm:px-3 py-1.5 text-[11px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors " +
                  (i > 0 ? "border-l border-ink " : "") +
                  (active
                    ? "text-bg"
                    : "bg-bg text-ink hover:bg-panel2")
                }
              >
                {active && !reduceMotion && (
                  <motion.span
                    layoutId="leaderboard-tab-pill"
                    className="absolute inset-0 bg-ink"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {active && reduceMotion && (
                  <span className="absolute inset-0 bg-ink" />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[520px] border border-border -mx-3 sm:mx-0">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-panel2 sticky top-0 border-b-2 border-ink">
            <tr className="text-[11px] uppercase tracking-[0.12em] text-muted">
              <th className="text-left px-3 py-2.5">#</th>
              <th className="text-left px-3 py-2.5">Ticker</th>
              <th className="text-left px-3 py-2.5">Name</th>
              <th className="text-left px-3 py-2.5">Sector</th>
              <th className="text-right px-3 py-2.5">Buy</th>
              <th className="text-right px-3 py-2.5">Sell</th>
              <th className="text-right px-3 py-2.5">{isPnl ? "Est. P&L" : "Net"}</th>
              <th className="text-right px-3 py-2.5"># Tx</th>
            </tr>
          </thead>
          <AnimatePresence mode="wait" initial={false}>
            <motion.tbody
              key={`${tab}-${sector}-${isPnl ? snapshotPick : ""}`}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              {rows.map((s, i) => {
                const colVal = isPnl ? (s.estPnL ?? 0) : s.net;
                return (
                  <motion.tr
                    key={s.ticker}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.28,
                      delay: reduceMotion ? 0 : Math.min(i * 0.018, 0.32),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="border-t border-border hover:bg-panel2/40"
                  >
                    <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      <Link
                        to={`/stock/${encodeURIComponent(s.ticker)}`}
                        className="text-accent hover:underline"
                      >
                        {s.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[260px]" title={s.name}>{s.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        to={`/sector/${encodeURIComponent(s.sector)}`}
                        className="text-muted hover:text-accent hover:underline"
                      >
                        {s.sector}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-buy whitespace-nowrap">{fmt$(s.totalBuy)}</td>
                    <td className="px-3 py-2 text-right text-sell whitespace-nowrap">{fmt$(s.totalSell)}</td>
                    <td className={"px-3 py-2 text-right font-medium whitespace-nowrap " + (colVal >= 0 ? "text-buy" : "text-sell")}>
                      {fmtSigned$(colVal)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{s.txCount}</td>
                  </motion.tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">No results</td></tr>
              )}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>
    </section>
  );
}
