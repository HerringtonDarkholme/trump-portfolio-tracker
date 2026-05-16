import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$ } from "../lib/format";
import StockMonthlyChart from "../components/StockMonthlyChart";
import { KpiInt, KpiDollar } from "../components/Kpi";

type SortKey = "n" | "date" | "type" | "amount" | "mid";

export default function Stock() {
  const { ticker = "" } = useParams();
  const stock = dataset.stocks[ticker];

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sortedTx = useMemo(() => {
    if (!stock) return [];
    const arr = stock.transactions.slice();
    arr.sort((a, b) => {
      let x: any = a[sortKey];
      let y: any = b[sortKey];
      if (typeof x === "string") return x.localeCompare(y) * sortDir;
      return (x - y) * sortDir;
    });
    return arr;
  }, [stock, sortKey, sortDir]);

  if (!stock) {
    return (
      <div className="bg-panel border border-border p-8 text-center">
        <div className="text-lg mb-2">Ticker not found</div>
        <div className="text-muted text-sm mb-4">No record of <code>{ticker}</code> in the dataset.</div>
        <Link to="/" className="text-accent hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  const unknown = stock.ticker.startsWith("UNKN-");

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === "date" ? -1 : 1); }
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <nav className="text-xs text-muted truncate">
        <Link to="/" className="hover:text-accent2">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/sector/${encodeURIComponent(stock.sector)}`} className="hover:text-accent">
          {stock.sector}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink font-mono">{stock.ticker}</span>
      </nav>

      <header className="bg-panel border border-border p-3 sm:p-5">
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
          <h1 className="font-serif text-2xl sm:text-3xl text-ink break-words">{stock.name}</h1>
          <span className="font-mono text-accent2 text-base sm:text-lg">{stock.ticker}</span>
          <span className="text-[11px] tracking-[0.12em] uppercase px-2 py-0.5 bg-panel2 border border-border text-muted">
            {stock.sector}
          </span>
          {stock.resolution === "fuzzy" && (
            <span className="text-[11px] tracking-[0.1em] uppercase px-2 py-0.5 bg-accent/15 text-accent2 border border-accent2">
              Fuzzy Matched
            </span>
          )}
        </div>
        {unknown && (
          <div className="mt-2 text-xs text-accent2">
            Ticker not identified — add this canonical name to <code>data/ticker-seed.json</code> to map it.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <KpiDollar variant="md" label="Total purchased" value={stock.totalBuy}  color="buy" />
          <KpiDollar variant="md" label="Total sold"      value={stock.totalSell} color="sell" />
          <KpiDollar variant="md" label="Net flow"        value={stock.net} signed color={stock.net >= 0 ? "buy" : "sell"} />
          <KpiInt    variant="md" label="Transactions"    value={stock.txCount} />
        </div>
      </header>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Daily activity
        </h2>
        <StockMonthlyChart transactions={stock.transactions} />
      </section>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          All transactions ({stock.transactions.length})
        </h2>
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-border -mx-3 sm:mx-0">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-panel2 sticky top-0">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <Th onClick={() => setSort("n")} active={sortKey === "n"} dir={sortDir}>#</Th>
                <Th onClick={() => setSort("date")} active={sortKey === "date"} dir={sortDir}>Date</Th>
                <Th onClick={() => setSort("type")} active={sortKey === "type"} dir={sortDir}>Type</Th>
                <Th onClick={() => setSort("amount")} active={sortKey === "amount"} dir={sortDir}>Amount range</Th>
                <Th onClick={() => setSort("mid")} active={sortKey === "mid"} dir={sortDir} className="text-right">Est. midpoint</Th>
                <th className="text-left px-3 py-2">Raw description</th>
              </tr>
            </thead>
            <tbody>
              {sortedTx.map((t, i) => (
                <tr key={i} className="border-t border-border hover:bg-panel2/60">
                  <td className="px-3 py-2 font-mono text-muted tabular-nums">{t.n}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{t.date}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full font-medium " +
                        (t.type === "purchase"
                          ? "bg-buy/15 text-buy"
                          : "bg-sell/15 text-sell")
                      }
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt$(t.mid)}</td>
                  <td className="px-3 py-2 text-muted text-xs truncate max-w-[420px]" title={t.rawDescription}>
                    {t.rawDescription}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: 1 | -1;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={"text-left px-3 py-2 cursor-pointer select-none hover:text-accent2 " + className}
    >
      {children}
      {active && <span className="ml-1 text-[11px]">{dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );
}
