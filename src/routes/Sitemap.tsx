import { useMemo } from "react";
import { Link } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$, fmtInt } from "../lib/format";

export default function Sitemap() {
  const sectors = useMemo(
    () => Object.values(dataset.sectors).sort((a, b) => b.totalVolume - a.totalVolume),
    []
  );

  const stocksBySector = useMemo(() => {
    const grouped: Record<string, typeof dataset.stocks[string][]> = {};
    for (const s of Object.values(dataset.stocks)) {
      (grouped[s.sector] ??= []).push(s);
    }
    for (const sec of Object.keys(grouped)) {
      grouped[sec].sort((a, b) => (b.totalBuy + b.totalSell) - (a.totalBuy + a.totalSell));
    }
    return grouped;
  }, []);

  const days = useMemo(() => {
    const set = new Set<string>();
    for (const s of Object.values(dataset.stocks)) for (const t of s.transactions) set.add(t.date);
    return [...set].sort();
  }, []);

  const totalStocks = Object.keys(dataset.stocks).length;

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <nav className="text-xs text-muted truncate">
        <Link to="/" className="hover:text-accent2">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">Sitemap</span>
      </nav>

      <header className="bg-panel border border-border p-3 sm:p-5">
        <h1 className="font-serif text-2xl sm:text-3xl text-ink">Sitemap</h1>
        <div className="text-xs text-muted mt-1">
          Index of every page on the site.{" "}
          <a href="/sitemap.xml" className="text-accent hover:underline" target="_blank" rel="noreferrer">
            sitemap.xml
          </a>{" "}
          is also available for search engines.
        </div>
      </header>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Top-level
        </h2>
        <ul className="text-sm space-y-1">
          <li><Link to="/" className="text-accent hover:underline">/</Link> — Home dashboard</li>
        </ul>
      </section>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Sectors ({sectors.length})
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {sectors.map((sec) => (
            <li key={sec.sector} className="flex items-baseline justify-between gap-3">
              <Link
                to={`/sector/${encodeURIComponent(sec.sector)}`}
                className="text-accent hover:underline truncate"
              >
                {sec.sector}
              </Link>
              <span className="text-xs text-muted whitespace-nowrap">
                {sec.tickers.length} tickers · {fmt$(sec.totalVolume)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Tickers ({fmtInt(totalStocks)})
        </h2>
        <div className="space-y-4">
          {sectors.map((sec) => (
            <details key={sec.sector} className="border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold hover:bg-panel2/60">
                {sec.sector}{" "}
                <span className="text-xs text-muted font-normal">({stocksBySector[sec.sector].length})</span>
              </summary>
              <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1 text-xs">
                {stocksBySector[sec.sector].map((s) => (
                  <Link
                    key={s.ticker}
                    to={`/stock/${encodeURIComponent(s.ticker)}`}
                    className="text-accent hover:underline truncate font-mono"
                    title={s.name}
                  >
                    {s.ticker}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-panel border border-border p-3 sm:p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
          Days with activity ({days.length})
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-x-3 gap-y-1 text-xs">
          {days.map((d) => (
            <Link
              key={d}
              to={`/day/${d}`}
              className="text-accent hover:underline font-mono"
            >
              {d}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
