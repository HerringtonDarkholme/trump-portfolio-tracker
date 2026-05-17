import { dataset } from "../lib/dataset";
import { KpiInt, KpiDollar } from "../components/Kpi";
import SectorHeatmap from "../components/SectorHeatmap";
import Leaderboard from "../components/Leaderboard";
import DailyActivityChart from "../components/DailyActivityChart";
import PortfolioYield from "../components/PortfolioYield";

const SOURCE_PDF_URL =
  "https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/405E4EC4E27BE8D185258DF7002DD1C0/$FILE/Trump%2C%20Donald%20J.-05.08.2026-278T(2).pdf";

export default function Home() {
  const t = dataset.totals;
  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <p className="text-[11px] sm:text-xs tracking-[0.14em] uppercase text-muted whitespace-nowrap overflow-x-auto">
        President Trump&apos;s 2026 portfolio transactions, estimated from{" "}
        <a
          href={SOURCE_PDF_URL}
          target="_blank"
          rel="noreferrer"
          className="text-accent2 hover:text-ink underline underline-offset-4 decoration-border hover:decoration-accent2"
        >
          public disclosed value ranges
        </a>
        .
      </p>

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
      <PortfolioYield />
    </div>
  );
}
