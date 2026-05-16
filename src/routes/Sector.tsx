import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$ } from "../lib/format";
import SectorHeatmap from "../components/SectorHeatmap";
import DailyActivityChart from "../components/DailyActivityChart";
import { KpiInt, KpiDollar } from "../components/Kpi";

type SortKey = "n" | "date" | "ticker" | "type" | "amount" | "mid";
type Row = {
  n: number;
  date: string;
  ticker: string;
  stockName: string;
  type: "purchase" | "sale";
  amount: string;
  mid: number;
  rawDescription: string;
};

export default function Sector() {
  const { sector = "" } = useParams();
  const decoded = decodeURIComponent(sector);

  const stocks = useMemo(
    () =>
      Object.values(dataset.stocks).filter((s) => s.sector === decoded),
    [decoded]
  );

  const allTx = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const s of stocks) {
      for (const t of s.transactions) {
        rows.push({
          n: t.n,
          date: t.date,
          ticker: s.ticker,
          stockName: s.name,
          type: t.type,
          amount: t.amount,
          mid: t.mid,
          rawDescription: t.rawDescription,
        });
      }
    }
    return rows;
  }, [stocks]);

  const totals = useMemo(() => {
    let buy = 0, sell = 0, buys = 0, sells = 0;
    for (const r of allTx) {
      if (r.type === "purchase") { buy += r.mid; buys++; } else { sell += r.mid; sells++; }
    }
    return {
      tickers: stocks.length,
      totalBuy: buy,
      totalSell: sell,
      net: buy - sell,
      txCount: allTx.length,
      buys, sells,
    };
  }, [stocks, allTx]);

  const [sortKey, setSortKey] = useState<SortKey>("date");
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

  if (stocks.length === 0) {
    return (
      <div className="bg-panel border border-border p-8 text-center">
        <div className="text-lg mb-2">Sector not found</div>
        <div className="text-muted text-sm mb-4">No tickers in <code>{decoded}</code>.</div>
        <Link to="/" className="text-accent hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === "date" ? -1 : 1); }
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <nav className="text-xs text-muted truncate">
        <Link to="/" className="hover:text-accent2">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{decoded}</span>
      </nav>

      <header className="bg-panel border border-border p-3 sm:p-5">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink break-words">{decoded}</h1>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          <KpiInt variant="md" label="Tickers" value={totals.tickers} />
          <KpiInt variant="md" label="Transactions" value={totals.txCount} sub={`${totals.buys} buys · ${totals.sells} sells`} />
          <KpiDollar variant="md" label="Total purchased" value={totals.totalBuy}  color="buy" />
          <KpiDollar variant="md" label="Total sold"      value={totals.totalSell} color="sell" />
          <KpiDollar variant="md" label="Net flow"        value={totals.net} signed color={totals.net >= 0 ? "buy" : "sell"} />
        </div>
      </header>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted mb-1">
          Daily activity in {decoded}
        </h2>
        <div className="text-xs text-muted mb-3">
          Purchases above zero, sales below. Error bars = disclosed dollar range per day.
        </div>
        <DailyActivityChart sector={decoded} />
      </section>

      <SectorHeatmap sectorFilter={decoded} height={420} />

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          All transactions ({sortedTx.length})
        </h2>
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-border -mx-3 sm:mx-0">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-panel2 sticky top-0">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <Th onClick={() => setSort("n")} active={sortKey === "n"} dir={sortDir}>#</Th>
                <Th onClick={() => setSort("date")} active={sortKey === "date"} dir={sortDir}>Date</Th>
                <Th onClick={() => setSort("ticker")} active={sortKey === "ticker"} dir={sortDir}>Ticker</Th>
                <th className="text-left px-3 py-2">Name</th>
                <Th onClick={() => setSort("type")} active={sortKey === "type"} dir={sortDir}>Type</Th>
                <Th onClick={() => setSort("amount")} active={sortKey === "amount"} dir={sortDir}>Amount range</Th>
                <Th onClick={() => setSort("mid")} active={sortKey === "mid"} dir={sortDir} className="text-right">Est. midpoint</Th>
              </tr>
            </thead>
            <tbody>
              {sortedTx.map((t, i) => (
                <tr key={i} className="border-t border-border hover:bg-panel2/60">
                  <td className="px-3 py-2 font-mono text-muted tabular-nums">{t.n}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2 font-mono">
                    <Link to={`/stock/${encodeURIComponent(t.ticker)}`} className="text-accent hover:underline">
                      {t.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 truncate max-w-[260px]" title={t.rawDescription}>{t.stockName}</td>
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
