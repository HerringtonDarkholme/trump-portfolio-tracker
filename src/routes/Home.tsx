import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$, fmtInt } from "../lib/format";
import SectorHeatmap from "../components/SectorHeatmap";
import Leaderboard from "../components/Leaderboard";
import DailyActivityChart from "../components/DailyActivityChart";

export default function Home() {
  const t = dataset.totals;
  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Transactions" value={fmtInt(t.txCount)} sub={`${fmtInt(t.buyCount)} buys · ${fmtInt(t.sellCount)} sells`} />
        <Kpi label="Total volume (est.)" value={fmt$(t.totalVolume)} sub="Sum of bucket midpoints" />
        <Kpi label="Net flow" value={fmtSigned$(t.netFlow)} sub="Buys − Sells" color={t.netFlow >= 0 ? "buy" : "sell"} />
        <Kpi label="Unique tickers" value={fmtInt(t.uniqueTickers)} sub={`${t.uniqueTickers - t.unresolvedCount} resolved`} />
        <Kpi label="Unresolved names" value={fmtInt(t.unresolvedCount)} sub="Long tail / OCR — edit ticker-seed.json" />
      </section>

      <section className="bg-panel border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-1">
          Daily activity (all holdings)
        </h2>
        <div className="text-xs text-muted mb-3">
          Purchases above zero, sales below. Error bars = disclosed dollar range per day.
        </div>
        <DailyActivityChart />
      </section>

      <SectorHeatmap />
      <Leaderboard />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "buy" | "sell";
}) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={"mt-1 text-2xl font-semibold tracking-tight " + (color === "buy" ? "text-buy" : color === "sell" ? "text-sell" : "text-white")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  );
}
