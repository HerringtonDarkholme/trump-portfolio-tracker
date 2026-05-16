import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$ } from "../lib/format";
import StockMonthlyChart from "../components/StockMonthlyChart";

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
      <div className="bg-panel border border-border rounded-xl p-8 text-center">
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
    <div className="grid gap-6">
      <nav className="text-xs text-muted">
        <Link to="/" className="hover:text-white">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/sector/${encodeURIComponent(stock.sector)}`} className="hover:text-accent">
          {stock.sector}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-white font-mono">{stock.ticker}</span>
      </nav>

      <header className="bg-panel border border-border rounded-xl p-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{stock.name}</h1>
          <span className="font-mono text-accent text-lg">{stock.ticker}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-panel2 border border-border text-muted">
            {stock.sector}
          </span>
          {stock.resolution === "fuzzy" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
              fuzzy-matched
            </span>
          )}
        </div>
        {unknown && (
          <div className="mt-2 text-xs text-yellow-300/80">
            Ticker not identified — add this canonical name to <code>data/ticker-seed.json</code> to map it.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Mini label="Total purchased" value={fmt$(stock.totalBuy)} color="buy" />
          <Mini label="Total sold"      value={fmt$(stock.totalSell)} color="sell" />
          <Mini
            label="Net flow"
            value={fmtSigned$(stock.net)}
            color={stock.net >= 0 ? "buy" : "sell"}
          />
          <Mini label="Transactions" value={String(stock.txCount)} />
        </div>
      </header>

      <section className="bg-panel border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Daily activity
        </h2>
        <StockMonthlyChart transactions={stock.transactions} />
      </section>

      <section className="bg-panel border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          All transactions ({stock.transactions.length})
        </h2>
        <div className="overflow-auto max-h-[600px] border border-border rounded-lg">
          <table className="w-full text-sm">
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
                  <td className="px-3 py-2 font-mono">{t.date}</td>
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
                  <td className="px-3 py-2">{t.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt$(t.mid)}</td>
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

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "buy" | "sell";
}) {
  return (
    <div className="bg-panel2/60 border border-border rounded-lg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={"mt-1 text-lg font-semibold " + (color === "buy" ? "text-buy" : color === "sell" ? "text-sell" : "text-white")}>
        {value}
      </div>
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
      className={"text-left px-3 py-2 cursor-pointer select-none hover:text-white " + className}
    >
      {children}
      {active && <span className="ml-1 text-[10px]">{dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );
}
