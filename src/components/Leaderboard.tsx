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
    <section className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Leaderboard
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted">Sector:</label>
          <select
            className="bg-panel2 border border-border rounded px-2 py-1 text-white"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "px-3 py-1.5 rounded-md text-xs font-medium " +
              (tab === t.id
                ? "bg-accent/20 text-accent border border-accent/40"
                : "bg-panel2 text-muted hover:text-white border border-border")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-auto max-h-[520px] border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-panel2 sticky top-0">
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Ticker</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Sector</th>
              <th className="text-right px-3 py-2">Buy</th>
              <th className="text-right px-3 py-2">Sell</th>
              <th className="text-right px-3 py-2">Net</th>
              <th className="text-right px-3 py-2"># Tx</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.ticker} className="border-t border-border hover:bg-panel2/60">
                <td className="px-3 py-2 text-muted">{i + 1}</td>
                <td className="px-3 py-2 font-mono">
                  <Link
                    to={`/stock/${encodeURIComponent(s.ticker)}`}
                    className="text-accent hover:underline"
                  >
                    {s.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 truncate max-w-[260px]" title={s.name}>{s.name}</td>
                <td className="px-3 py-2 text-muted">{s.sector}</td>
                <td className="px-3 py-2 text-right text-buy">{fmt$(s.totalBuy)}</td>
                <td className="px-3 py-2 text-right text-sell">{fmt$(s.totalSell)}</td>
                <td className={"px-3 py-2 text-right font-medium " + (s.net >= 0 ? "text-buy" : "text-sell")}>
                  {fmtSigned$(s.net)}
                </td>
                <td className="px-3 py-2 text-right">{s.txCount}</td>
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
