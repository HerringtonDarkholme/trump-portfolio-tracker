import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$, fmtInt } from "../lib/format";
import SectorHeatmap from "../components/SectorHeatmap";
import Leaderboard from "../components/Leaderboard";
import DailyActivityChart from "../components/DailyActivityChart";

export default function Home() {
  const t = dataset.totals;
  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Transactions" value={fmtInt(t.txCount)} sub={`${fmtInt(t.buyCount)} buys · ${fmtInt(t.sellCount)} sells`} />
        <Kpi label="Total volume (est.)" value={fmt$(t.totalVolume)} sub="Sum of bucket midpoints" />
        <Kpi label="Net flow" value={fmtSigned$(t.netFlow)} sub="Buys − Sells" color={t.netFlow >= 0 ? "buy" : "sell"} />
        <Kpi label="Unique tickers" value={fmtInt(t.uniqueTickers)} sub="All resolved" />
      </section>

      <section className="bg-panel border border-border p-5">
        <h2 className="font-serif text-2xl text-ink mb-1">
          Daily Activity
        </h2>
        <div className="text-[11px] tracking-[0.1em] uppercase text-muted mb-3">
          All holdings · purchases above zero · sales below · bands = disclosed range
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
    <div className="bg-panel border border-border p-5 relative">
      <div className="absolute top-0 left-0 w-12 h-0.5 bg-accent" />
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={"mt-2 text-3xl font-serif " + (color === "buy" ? "text-buy" : color === "sell" ? "text-sell" : "text-ink")}>
        {value}
      </div>
      {sub && <div className="text-[10px] tracking-[0.1em] uppercase text-muted mt-1.5">{sub}</div>}
    </div>
  );
}
