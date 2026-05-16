import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$ } from "../lib/format";

type Tab = "netBuy" | "netSell" | "volume" | "active";
const TABS: { id: Tab; label: string }[] = [
  { id: "netBuy", label: "Biggest net buys" },
  { id: "netSell", label: "Biggest net sells" },
  { id: "volume", label: "Highest volume" },
  { id: "active", label: "Most active" },
];

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>("netBuy");
  const [sector, setSector] = useState<string>("All");

  const sectors = useMemo(
    () => ["All", ...Object.keys(dataset.sectors).sort()],
    []
  );

  const rows = useMemo(() => {
    let list = Object.values(dataset.stocks);
    if (sector !== "All") list = list.filter((s) => s.sector === sector);
    switch (tab) {
      case "netBuy":  list = list.filter((s) => s.net > 0).sort((a, b) => b.net - a.net); break;
      case "netSell": list = list.filter((s) => s.net < 0).sort((a, b) => a.net - b.net); break;
      case "volume":  list = list.sort((a, b) => (b.totalBuy + b.totalSell) - (a.totalBuy + a.totalSell)); break;
      case "active":  list = list.sort((a, b) => b.txCount - a.txCount); break;
    }
    return list.slice(0, 25);
  }, [tab, sector]);

  return (
    <section className="bg-panel border border-border p-3 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="font-serif text-xl sm:text-2xl text-ink">
          Leaderboard
        </h2>
        <div className="flex items-center gap-2 text-xs">
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

      <div className="-mx-3 sm:mx-0 mb-4 overflow-x-auto">
        <div className="inline-flex border border-ink mx-3 sm:mx-0">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "px-2.5 sm:px-3 py-1.5 text-[11px] tracking-[0.12em] uppercase whitespace-nowrap " +
                (i > 0 ? "border-l border-ink " : "") +
                (tab === t.id
                  ? "bg-ink text-bg"
                  : "bg-bg text-ink hover:bg-panel2")
              }
            >
              {t.label}
            </button>
          ))}
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
              <th className="text-right px-3 py-2.5">Net</th>
              <th className="text-right px-3 py-2.5"># Tx</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.ticker} className="border-t border-border hover:bg-panel2/40">
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
                <td className={"px-3 py-2 text-right font-medium whitespace-nowrap " + (s.net >= 0 ? "text-buy" : "text-sell")}>
                  {fmtSigned$(s.net)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{s.txCount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
