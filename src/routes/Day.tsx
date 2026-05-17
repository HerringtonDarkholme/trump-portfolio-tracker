import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$ } from "../lib/format";
import SectorHeatmap from "../components/SectorHeatmap";
import { KpiInt, KpiDollar } from "../components/Kpi";

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
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <header className="bg-panel border border-border p-3 sm:p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-serif text-2xl sm:text-3xl text-ink break-words min-w-0">{friendly}</h1>
          <nav
            aria-label="Breadcrumb"
            className="ml-auto flex items-center gap-2.5 shrink-0"
          >
            <span className="font-mono text-accent2 text-base sm:text-lg leading-none px-2.5 py-1 bg-panel2 border border-accent2">
              {date}
            </span>
            <span className="text-muted/40 text-sm">/</span>
            <Link
              to="/"
              aria-label="Home"
              title="Home"
              className="text-muted hover:text-accent2 inline-flex items-center p-1"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 11l9-8 9 8" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V9.5" />
              </svg>
            </Link>
          </nav>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          <KpiInt variant="md" label="Transactions" value={totals.txCount} sub={`${totals.buys} buys · ${totals.sells} sells`} />
          <KpiInt variant="md" label="Tickers"      value={totals.tickers}  sub={`${totals.sectors} sectors`} />
          <KpiDollar variant="md" label="Total purchased" value={totals.totalBuy}  color="buy" />
          <KpiDollar variant="md" label="Total sold"      value={totals.totalSell} color="sell" />
          <KpiDollar variant="md" label="Net flow"        value={totals.net} signed color={totals.net >= 0 ? "buy" : "sell"} />
        </div>
      </header>

      <SectorHeatmap dayFilter={date} height={420} />

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          All transactions on {date} ({sortedTx.length})
        </h2>
        <div className="overflow-x-auto overflow-y-auto max-h-[700px] border border-border -mx-3 sm:mx-0">
          <table className="w-full text-sm min-w-[800px]">
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
                  <td className="px-3 py-2 whitespace-nowrap">{t.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt$(t.mid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({ children, onClick, active, dir, className = "" }: {
  children: React.ReactNode; onClick: () => void; active: boolean; dir: 1 | -1; className?: string;
}) {
  return (
    <th onClick={onClick} className={"text-left px-3 py-2 cursor-pointer select-none hover:text-accent2 " + className}>
      {children}
      {active && <span className="ml-1 text-[11px]">{dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );
}
