import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$, fmtInt } from "../lib/format";
import SectorHeatmap from "../components/SectorHeatmap";

type SortKey = "n" | "ticker" | "sector" | "type" | "amount" | "mid";

type Row = {
  n: number;
  ticker: string;
  stockName: string;
  sector: string;
  type: "purchase" | "sale";
  amount: string;
  mid: number;
  rawDescription: string;
};

export default function Day() {
  const { date = "" } = useParams();

  const allTx = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const s of Object.values(dataset.stocks)) {
      for (const t of s.transactions) {
        if (t.date !== date) continue;
        rows.push({
          n: t.n,
          ticker: s.ticker,
          stockName: s.name,
          sector: s.sector,
          type: t.type,
          amount: t.amount,
          mid: t.mid,
          rawDescription: t.rawDescription,
        });
      }
    }
    return rows;
  }, [date]);

  const totals = useMemo(() => {
    let buy = 0, sell = 0, buys = 0, sells = 0;
    const sectors = new Set<string>();
    const tickers = new Set<string>();
    for (const r of allTx) {
      tickers.add(r.ticker);
      sectors.add(r.sector);
      if (r.type === "purchase") { buy += r.mid; buys++; } else { sell += r.mid; sells++; }
    }
    return {
      tickers: tickers.size,
      sectors: sectors.size,
      totalBuy: buy,
      totalSell: sell,
      net: buy - sell,
      txCount: allTx.length,
      buys, sells,
    };
  }, [allTx]);

  const [sortKey, setSortKey] = useState<SortKey>("mid");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sortedTx = useMemo(() => {
    const arr = allTx.slice();
    arr.sort((a, b) => {
      const x: unknown = (a as Record<string, unknown>)[sortKey];
      const y: unknown = (b as Record<string, unknown>)[sortKey];
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * sortDir;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sortDir;
      return 0;
    });
    return arr;
  }, [allTx, sortKey, sortDir]);

  if (allTx.length === 0) {
    return (
      <div className="bg-panel border border-border p-8 text-center">
        <div className="text-lg mb-2">No transactions on {date}</div>
        <div className="text-muted text-sm mb-4">Either no activity was reported, or the date format is invalid.</div>
        <Link to="/" className="text-accent hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(1); }
  }

  // Friendly date
  const d = new Date(date + "T00:00:00Z");
  const friendly = d.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });

  return (
    <div className="grid gap-6">
      <nav className="text-xs text-muted">
        <Link to="/" className="hover:text-accent2">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink font-mono">{date}</span>
      </nav>

      <header className="bg-panel border border-border p-5">
        <h1 className="font-serif text-3xl text-ink">{friendly}</h1>
        <div className="text-xs text-muted mt-1 font-mono">{date}</div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Mini label="Transactions" value={fmtInt(totals.txCount)} sub={`${totals.buys} buys · ${totals.sells} sells`} />
          <Mini label="Tickers"      value={fmtInt(totals.tickers)} sub={`${totals.sectors} sectors`} />
          <Mini label="Total purchased" value={fmt$(totals.totalBuy)} color="buy" />
          <Mini label="Total sold"      value={fmt$(totals.totalSell)} color="sell" />
          <Mini label="Net flow" value={fmtSigned$(totals.net)} color={totals.net >= 0 ? "buy" : "sell"} />
        </div>
      </header>

      <SectorHeatmap dayFilter={date} height={420} />

      <section className="bg-panel border border-border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          All transactions on {date} ({sortedTx.length})
        </h2>
        <div className="overflow-auto max-h-[700px] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel2 sticky top-0">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <Th onClick={() => setSort("n")} active={sortKey === "n"} dir={sortDir}>#</Th>
                <Th onClick={() => setSort("ticker")} active={sortKey === "ticker"} dir={sortDir}>Ticker</Th>
                <th className="text-left px-3 py-2">Name</th>
                <Th onClick={() => setSort("sector")} active={sortKey === "sector"} dir={sortDir}>Sector</Th>
                <Th onClick={() => setSort("type")} active={sortKey === "type"} dir={sortDir}>Type</Th>
                <Th onClick={() => setSort("amount")} active={sortKey === "amount"} dir={sortDir}>Amount range</Th>
                <Th onClick={() => setSort("mid")} active={sortKey === "mid"} dir={sortDir} className="text-right">Est. midpoint</Th>
              </tr>
            </thead>
            <tbody>
              {sortedTx.map((t, i) => (
                <tr key={i} className="border-t border-border hover:bg-panel2/60">
                  <td className="px-3 py-2 font-mono text-muted tabular-nums">{t.n}</td>
                  <td className="px-3 py-2 font-mono">
                    <Link to={`/stock/${encodeURIComponent(t.ticker)}`} className="text-accent hover:underline">
                      {t.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 truncate max-w-[260px]" title={t.rawDescription}>{t.stockName}</td>
                  <td className="px-3 py-2">
                    <Link to={`/sector/${encodeURIComponent(t.sector)}`} className="text-muted hover:text-accent hover:underline">
                      {t.sector}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (t.type === "purchase" ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell")}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt$(t.mid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: "buy" | "sell" }) {
  return (
    <div className="bg-bg border border-border p-3 relative">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={"mt-1 text-lg font-semibold " + (color === "buy" ? "text-buy" : color === "sell" ? "text-sell" : "text-ink")}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({ children, onClick, active, dir, className = "" }: {
  children: React.ReactNode; onClick: () => void; active: boolean; dir: 1 | -1; className?: string;
}) {
  return (
    <th onClick={onClick} className={"text-left px-3 py-2 cursor-pointer select-none hover:text-accent2 " + className}>
      {children}
      {active && <span className="ml-1 text-[10px]">{dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );
}
