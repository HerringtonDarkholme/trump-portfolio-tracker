import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { dataset } from "../lib/dataset";
import { fmt$, fmtSigned$ } from "../lib/format";
import StockMonthlyChart from "../components/StockMonthlyChart";
import MarketChart, { MarketChartLegend } from "../components/MarketChart";
import CompanyLogo from "../components/CompanyLogo";
import { KpiInt, KpiDollar, KpiPct, KpiNum } from "../components/Kpi";

type SortKey = "n" | "date" | "type" | "amount" | "mid";
type Candle = { time: string; open: number; high: number; low: number; close: number };

// The most recent batch of Trump's 278-T filings was publicly released on
// 2026-05-14, so that's the natural snapshot date for yield calculations:
// every transaction in the dataset is known and disclosed as of that day.
const SNAPSHOT_DATE = "2026-05-14";

function yieldColor(v: number): "buy" | "sell" | undefined {
  if (v > 0) return "buy";
  if (v < 0) return "sell";
  return undefined;
}

export default function Stock() {
  const { ticker = "" } = useParams();
  const stock = dataset.stocks[ticker];

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [priceMap, setPriceMap] = useState<Map<string, Candle> | null>(null);

  // Sticky condensed bar appears once the market-chart section (and the
  // company logo it carries) scrolls behind the site header.
  const chartSectionRef = useRef<HTMLElement>(null);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    function measure() {
      const header = document.querySelector("header");
      setHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let raf: number | null = null;
    function check() {
      raf = null;
      const el = chartSectionRef.current;
      if (!el) {
        setStickyBarVisible(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const header = document.querySelector("header");
      const hh = header?.getBoundingClientRect().height ?? 0;
      // Once the section's top has crossed the site-header bottom, the chart
      // logo is hidden — that's our cue.
      setStickyBarVisible(rect.top < hh);
    }
    function onScroll() {
      if (raf == null) raf = requestAnimationFrame(check);
    }
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [stock]);

  useEffect(() => {
    setPriceMap(null);
    if (!stock) return;
    const unknown = stock.ticker.startsWith("UNKN-");
    // Mirror Market chart's eligibility check — skip tickers that won't have
    // price data on disk (unresolved, money-market, suffix-tagged holdings).
    const eligible =
      !unknown &&
      stock.sector !== "Money Market" &&
      !/\.[A-Z]+$/.test(stock.ticker);
    if (!eligible) return;
    let cancelled = false;
    fetch(`/prices/${encodeURIComponent(stock.ticker)}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.candles) return;
        const m = new Map<string, Candle>();
        for (const c of json.candles as Candle[]) m.set(c.time, c);
        setPriceMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stock]);

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

  // Estimated yield using per-transaction close prices. Total P&L decomposes
  // into a sum of independent per-transaction terms that are LINEAR in the
  // disclosed amount, so max/min over each transaction's [low, high] range
  // resolves greedily — no DP needed.
  //
  //   Purchase contribution = a × (p_final / p_buy − 1)
  //   Sale contribution     = a × (1 − p_final / p_sell)
  //
  // Sign of the coefficient picks whether to use `high` or `low` at each
  // extreme.
  const yieldEstimate = useMemo(() => {
    if (!stock || !priceMap || priceMap.size === 0) return null;
    // Anchor to SNAPSHOT_DATE (filing-release date). If the market was closed
    // that day, walk back to the nearest prior trading day we have data for.
    let snapshotDate = SNAPSHOT_DATE;
    let snapshotClose = priceMap.get(snapshotDate)?.close ?? 0;
    if (!snapshotClose) {
      for (const [date, c] of priceMap.entries()) {
        if (date <= SNAPSHOT_DATE && date > snapshotDate) {
          snapshotDate = date;
          snapshotClose = c.close;
        }
      }
    }
    if (!snapshotClose) return null;

    let estCost = 0;
    let estProceeds = 0;
    let estSharesHeld = 0;
    let estPnL = 0;
    let maxPnL = 0;
    let minPnL = 0;
    let counted = 0;
    let skipped = 0;

    for (const t of stock.transactions) {
      const c = priceMap.get(t.date);
      if (!c?.close) {
        skipped++;
        continue;
      }
      const p = c.close;
      if (t.type === "purchase") {
        estCost += t.mid;
        estSharesHeld += t.mid / p;
        const coef = snapshotClose / p - 1;
        estPnL += t.mid * coef;
        if (coef >= 0) {
          maxPnL += t.high * coef;
          minPnL += t.low * coef;
        } else {
          maxPnL += t.low * coef;
          minPnL += t.high * coef;
        }
      } else {
        estProceeds += t.mid;
        estSharesHeld -= t.mid / p;
        const coef = 1 - snapshotClose / p;
        estPnL += t.mid * coef;
        if (coef >= 0) {
          maxPnL += t.high * coef;
          minPnL += t.low * coef;
        } else {
          maxPnL += t.low * coef;
          minPnL += t.high * coef;
        }
      }
      counted++;
    }

    if (counted === 0) return null;
    const estHoldingValue = estSharesHeld * snapshotClose;
    // Use the LARGER of cost-basis or proceeds as the yield denominator. For
    // net buyers this is cost (capital deployed); for net sellers it's
    // proceeds (capital realised). Either way it reflects the magnitude of
    // dollar flow on the dominant side rather than artificially inflating
    // yield when only a small position was ever bought.
    const denomBase = Math.max(estCost, estProceeds);
    const denom = denomBase > 0 ? denomBase : 1;
    return {
      estCost,
      estProceeds,
      estSharesHeld,
      estHoldingValue,
      estPnL,
      estYieldPct: (estPnL / denom) * 100,
      maxPnL,
      maxYieldPct: (maxPnL / denom) * 100,
      minPnL,
      minYieldPct: (minPnL / denom) * 100,
      denomBase,
      snapshotDate,
      snapshotClose,
      counted,
      skipped,
    };
  }, [stock, priceMap]);

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
  // Only assets that trade on an exchange will resolve in TradingView. Skip
  // for unresolved tickers, money-market funds, and anything ending in .HA
  // (heuristic for non-exchange-traded holdings).
  const showMarketChart =
    !unknown &&
    stock.sector !== "Money Market" &&
    !/\.[A-Z]+$/.test(stock.ticker);

  function setSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(k === "date" ? -1 : 1); }
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-[minmax(0,1fr)]">
      <header className="bg-panel border border-border p-3 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <CompanyLogo
            ticker={stock.ticker}
            alt={`${stock.name} logo`}
            className="w-11 h-11 sm:w-14 sm:h-14 object-contain bg-bg rounded-sm border border-border p-1 shrink-0"
          />
          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap min-w-0">
            <h1 className="font-serif text-2xl sm:text-3xl text-ink break-words">{stock.name}</h1>
            {stock.resolution === "fuzzy" && (
              <span className="text-[11px] tracking-[0.1em] uppercase px-2 py-0.5 bg-accent/15 text-accent2 border border-accent2">
                Fuzzy Matched
              </span>
            )}
          </div>
          <nav
            aria-label="Breadcrumb"
            className="ml-auto flex items-center gap-2.5 shrink-0"
          >
            <span className="font-mono text-accent2 text-lg sm:text-xl leading-none">
              {stock.ticker}
            </span>
            <span className="text-muted/40 text-sm">/</span>
            <Link
              to={`/sector/${encodeURIComponent(stock.sector)}`}
              className="text-xs sm:text-sm tracking-[0.12em] uppercase px-2.5 py-1 bg-panel2 border border-border text-muted hover:text-accent2 hover:border-accent2"
            >
              {stock.sector}
            </Link>
            <span className="text-muted/40 text-sm">/</span>
            <Link
              to="/"
              aria-label="Home"
              title="Home"
              className="text-muted hover:text-accent2 inline-flex items-center p-1"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 11l9-8 9 8" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V9.5" />
              </svg>
            </Link>
          </nav>
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

      {showMarketChart && (
        <section ref={chartSectionRef} className="bg-panel border border-border p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted">
              Market chart · with transactions
            </h2>
            <div className="flex items-center gap-3 text-[11px] tracking-[0.12em] uppercase text-muted flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-buy" />
                Buy
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-sell" />
                Sell
              </span>
              <span className="inline-flex items-center gap-1 relative group cursor-help">
                <span
                  className="inline-block w-[7px] h-[7px] rotate-45"
                  style={{ background: "#ad880f" }}
                />
                <span className="underline decoration-dotted decoration-muted/70 underline-offset-[3px]">
                  Turnaround
                </span>
                <span
                  role="tooltip"
                  className="hidden group-hover:block group-focus-within:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-panel border border-ink shadow-lg px-3 py-2 text-[11px] normal-case tracking-normal text-ink leading-relaxed z-30 pointer-events-none"
                >
                  A day with both <span className="text-buy">buys</span> and{" "}
                  <span className="text-sell">sells</span>. The marker sits on
                  the dominant side; its size reflects <em>net</em> volume
                  (|buy − sell|).
                </span>
              </span>
              <span className="text-border">·</span>
              <span className="whitespace-nowrap">
                Daily price with transactions · via{" "}
                <a
                  href={`https://finance.yahoo.com/quote/${encodeURIComponent(stock.ticker)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent2 hover:text-ink underline underline-offset-2 decoration-border hover:decoration-accent2"
                >
                  Yahoo ↗
                </a>
              </span>
            </div>
          </div>
          <div className="h-[420px] sm:h-[520px] border border-border bg-bg">
            <MarketChart symbol={stock.ticker} name={stock.name} transactions={stock.transactions} />
          </div>
          <div className="mt-1">
            <MarketChartLegend />
          </div>
        </section>
      )}

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
          <table className="w-full text-sm min-w-[820px] tabular-nums">
            <thead className="bg-panel2 sticky top-0">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <Th onClick={() => setSort("n")} active={sortKey === "n"} dir={sortDir}>#</Th>
                <Th onClick={() => setSort("date")} active={sortKey === "date"} dir={sortDir}>Date</Th>
                <Th onClick={() => setSort("type")} active={sortKey === "type"} dir={sortDir}>Type</Th>
                <th className="text-right px-3 py-2 whitespace-nowrap" title="Daily close price on the transaction date">Est. price</th>
                <Th onClick={() => setSort("mid")} active={sortKey === "mid"} dir={sortDir} className="text-right">Est. amount</Th>
                <Th onClick={() => setSort("amount")} active={sortKey === "amount"} dir={sortDir} className="text-right">Amount range</Th>
                <th className="text-left px-3 py-2">Raw description</th>
              </tr>
            </thead>
            <tbody>
              {sortedTx.map((t, i) => (
                <tr key={i} className="border-t border-border hover:bg-panel2/60">
                  <td className="px-3 py-2 font-mono text-muted">{t.n}</td>
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
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <PriceCell candle={priceMap?.get(t.date) ?? null} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt$(t.mid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{t.amount}</td>
                  <td className="px-3 py-2 text-muted text-xs truncate max-w-[420px]" title={t.rawDescription}>
                    {t.rawDescription}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {yieldEstimate && (
        <section className="bg-panel border border-border p-3 sm:p-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted">
              Estimated yield
              <span className="ml-2 text-muted/70 normal-case tracking-normal font-normal">
                · as of{" "}
                <span className="font-mono text-ink">{yieldEstimate.snapshotDate}</span>
              </span>
            </h2>
            {yieldEstimate.skipped > 0 && (
              <span className="text-[11px] text-muted">
                {yieldEstimate.skipped} tx skipped — no price data
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            <KpiDollar
              variant="md"
              label="Est. cost"
              value={yieldEstimate.estCost}
              info={
                <CalcInfo
                  title="Estimated cost basis"
                  body={<>Sum of midpoint dollar amounts across all <span className="text-buy">purchase</span> transactions in the dataset.</>}
                  formula="Σ buy.mid"
                />
              }
            />
            <KpiDollar
              variant="md"
              label="Est. proceeds"
              value={yieldEstimate.estProceeds}
              info={
                <CalcInfo
                  title="Estimated proceeds"
                  body={<>Sum of midpoint dollar amounts across all <span className="text-sell">sale</span> transactions.</>}
                  formula="Σ sell.mid"
                />
              }
            />
            <KpiNum
              variant="md"
              label="Est. shares held"
              value={yieldEstimate.estSharesHeld}
              frac={2}
              info={
                <CalcInfo
                  title="Estimated shares held"
                  body={
                    <>
                      For each transaction we estimate the implied share count
                      by dividing the midpoint dollar amount by that day's
                      close price. Buys add, sells subtract.
                      <div className="mt-1.5 text-ink">
                        Negative values aren't a short position — they mean
                        the holder already owned shares before our dataset
                        starts and is disposing of that pre-existing position.
                      </div>
                    </>
                  }
                  formula={
                    <>
                      <div>Σ (buy.mid ÷ close_t)</div>
                      <div>  − Σ (sell.mid ÷ close_t)</div>
                    </>
                  }
                />
              }
            />
            <KpiDollar
              variant="md"
              label="Mark-to-market"
              value={yieldEstimate.estHoldingValue}
              sub={`@ $${yieldEstimate.snapshotClose.toFixed(2)}`}
              subInline
              info={
                <CalcInfo
                  title="Mark-to-market value"
                  body={
                    <>
                      Estimated net shares valued at the snapshot close on{" "}
                      <span className="font-mono">{yieldEstimate.snapshotDate}</span>.
                      <div className="mt-1.5 text-ink">
                        A negative value means the dataset shows more dollars
                        sold than bought — i.e. a pre-existing position
                        (held before our data window) is being disposed of.
                        It's not an actual short.
                      </div>
                    </>
                  }
                  formula={`shares × $${yieldEstimate.snapshotClose.toFixed(2)}`}
                />
              }
            />
            <KpiDollar
              variant="md"
              label="Est. P&L"
              value={yieldEstimate.estPnL}
              signed
              color={yieldEstimate.estPnL >= 0 ? "buy" : "sell"}
              info={
                <CalcInfo
                  title="Estimated P&L"
                  body={<>Sum of per-transaction profit/loss using midpoint amounts. Each contribution is the change in value between trade date and snapshot date <span className="font-mono">{yieldEstimate.snapshotDate}</span>.</>}
                  formula={
                    <>
                      <div>buy:&nbsp;&nbsp;a × (close_s ÷ close_t − 1)</div>
                      <div>sell: a × (1 − close_s ÷ close_t)</div>
                      <div className="mt-1 text-muted">a = transaction midpoint</div>
                    </>
                  }
                />
              }
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <KpiPct
              variant="md"
              label="Est. yield"
              value={yieldEstimate.estYieldPct}
              signed
              color={yieldColor(yieldEstimate.estYieldPct)}
              sub={fmtSigned$(yieldEstimate.estPnL)}
              subInline
              info={
                <CalcInfo
                  title="Estimated yield"
                  body="P&L expressed as a percentage of the larger of cost basis or proceeds — whichever side saw more dollar flow. Avoids inflating yield when only a small position was ever bought (net-sell case)."
                  formula="(P&L ÷ max(cost, proceeds)) × 100%"
                />
              }
            />
            <KpiPct
              variant="md"
              label="Best-case yield"
              value={yieldEstimate.maxYieldPct}
              signed
              color={yieldColor(yieldEstimate.maxYieldPct)}
              sub={fmtSigned$(yieldEstimate.maxPnL)}
              subInline
              info={
                <CalcInfo
                  title="Best-case yield"
                  body="For every transaction, pick the dollar amount within its disclosed range [low, high] that MAXIMISES its P&L contribution."
                  formula={
                    <>
                      <div>per-tx pick:</div>
                      <div>&nbsp;&nbsp;a = high if coef ≥ 0 else low</div>
                      <div className="mt-1">yield = (Σ a·coef ÷ max(cost, proceeds)) × 100%</div>
                    </>
                  }
                />
              }
            />
            <KpiPct
              variant="md"
              label="Worst-case yield"
              value={yieldEstimate.minYieldPct}
              signed
              color={yieldColor(yieldEstimate.minYieldPct)}
              sub={fmtSigned$(yieldEstimate.minPnL)}
              subInline
              info={
                <CalcInfo
                  title="Worst-case yield"
                  body="Same as best-case but pick the amount in each range that MINIMISES the P&L contribution."
                  formula={
                    <>
                      <div>per-tx pick:</div>
                      <div>&nbsp;&nbsp;a = low if coef ≥ 0 else high</div>
                      <div className="mt-1">yield = (Σ a·coef ÷ max(cost, proceeds)) × 100%</div>
                    </>
                  }
                />
              }
            />
          </div>

          <p className="mt-3 text-[11px] text-muted leading-relaxed">
            <strong className="text-ink">Anchored to {yieldEstimate.snapshotDate}.</strong>{" "}
            Trump's most recent 278-T filing batch was publicly released on{" "}
            <span className="font-mono">2026-05-14</span>, so holdings are
            marked at that day's close — every transaction in the dataset is
            known and disclosed as of then. Yield % is divided by{" "}
            <span className="font-mono">max(cost, proceeds)</span> — whichever
            side saw more dollar flow — so net-seller positions don't get an
            artificially inflated ratio. Best/worst pick each transaction's
            actual amount at the extreme of its disclosed range that maximises
            or minimises the per-transaction P&amp;L contribution.
          </p>
        </section>
      )}

      {showMarketChart &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden={!stickyBarVisible}
            className={`fixed left-0 right-0 z-10 transition-[transform,opacity,box-shadow] duration-300 ease-out bg-panel border-b border-border will-change-transform ${
              stickyBarVisible
                ? "translate-y-0 opacity-100 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)]"
                : "-translate-y-2 opacity-0 pointer-events-none shadow-none"
            }`}
            style={{ top: `${headerHeight}px` }}
          >
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
              <CompanyLogo
                ticker={stock.ticker}
                alt=""
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain bg-bg rounded-sm border border-border p-0.5 shrink-0"
              />
              <h2 className="font-serif text-lg sm:text-xl text-ink truncate min-w-0">
                {stock.name}
              </h2>
              <nav
                aria-label="Breadcrumb"
                className="ml-auto flex items-center gap-2.5 shrink-0"
              >
                <span className="font-mono text-accent2 text-base sm:text-lg leading-none">
                  {stock.ticker}
                </span>
                <span className="text-muted/40 text-sm">/</span>
                <Link
                  to={`/sector/${encodeURIComponent(stock.sector)}`}
                  className="text-xs sm:text-sm tracking-[0.12em] uppercase px-2.5 py-1 bg-panel2 border border-border text-muted hover:text-accent2 hover:border-accent2"
                >
                  {stock.sector}
                </Link>
                <span className="text-muted/40 text-sm">/</span>
                <Link
                  to="/"
                  aria-label="Home"
                  title="Home"
                  className="text-muted hover:text-accent2 inline-flex items-center p-1"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 11l9-8 9 8" />
                    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V9.5" />
                  </svg>
                </Link>
              </nav>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function CalcInfo({
  title,
  body,
  formula,
}: {
  title: string;
  body: React.ReactNode;
  formula: React.ReactNode;
}) {
  return (
    <>
      <div className="font-semibold mb-1 text-ink">{title}</div>
      <div className="text-muted leading-relaxed">{body}</div>
      <div className="mt-2 font-mono text-[10px] bg-panel2 border border-border px-2 py-1.5 leading-relaxed text-ink whitespace-pre-wrap break-words">
        {formula}
      </div>
    </>
  );
}

function PriceCell({ candle }: { candle: Candle | null }) {
  if (!candle) return <span className="text-muted">—</span>;
  return (
    <span className="relative inline-block group cursor-help">
      <span className="group-hover:underline group-hover:decoration-dotted group-hover:decoration-muted/60 group-hover:underline-offset-[3px]">
        {candle.close.toFixed(2)}
      </span>
      <span
        role="tooltip"
        className="hidden group-hover:block group-focus-within:block absolute right-full top-1/2 -translate-y-1/2 mr-2 z-30 bg-panel border border-ink shadow-lg px-2.5 py-1.5 text-[11px] text-ink whitespace-normal text-left pointer-events-none normal-case tracking-normal"
      >
        <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 font-mono tabular-nums">
          <span className="text-muted">Open</span>
          <span className="text-right">{candle.open.toFixed(2)}</span>
          <span className="text-muted">High</span>
          <span className="text-right">{candle.high.toFixed(2)}</span>
          <span className="text-muted">Low</span>
          <span className="text-right">{candle.low.toFixed(2)}</span>
          <span className="text-muted">Close</span>
          <span className="text-right">{candle.close.toFixed(2)}</span>
        </div>
      </span>
    </span>
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
