import { dataset } from "../lib/dataset";
import { KpiInt, KpiDollar } from "../components/Kpi";
import SectorHeatmap from "../components/SectorHeatmap";
import Leaderboard from "../components/Leaderboard";
import DailyActivityChart from "../components/DailyActivityChart";

export default function Home() {
  const t = dataset.totals;
  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <KpiInt
          label="Transactions"
          value={t.txCount}
          sub={`${t.buyCount.toLocaleString()} buys · ${t.sellCount.toLocaleString()} sells`}
        />
        <KpiDollar
          label="Total volume (est.)"
          value={t.totalVolume}
          sub="Sum of bucket midpoints"
        />
        <KpiDollar
          label="Net flow"
          value={t.netFlow}
          signed
          sub="Buys − Sells"
          color={t.netFlow >= 0 ? "buy" : "sell"}
        />
        <KpiInt label="Unique tickers" value={t.uniqueTickers} sub="All resolved" />
      </section>

      <section className="bg-panel border border-border p-3 sm:p-5">
        <h2 className="font-serif text-xl sm:text-2xl text-ink mb-1">
          Daily Activity
        </h2>
        <div className="text-[11px] sm:text-xs tracking-[0.1em] uppercase text-muted mb-3">
          All holdings · purchases above zero · sales below · bands = disclosed range
        </div>
        <DailyActivityChart />
      </section>

      <SectorHeatmap />
      <Leaderboard />
    </div>
  );
}
