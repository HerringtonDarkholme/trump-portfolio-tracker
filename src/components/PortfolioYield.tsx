import { useMemo, useState } from "react";
import { KpiDollar, KpiPct } from "./Kpi";
import SnapshotSelect from "./SnapshotSelect";
import { DEFAULT_SNAPSHOT_DATE } from "../lib/snapshot";
import { fmtSigned$ } from "../lib/format";
import portfolioYieldJson from "../data/portfolio-yield.json";
import type { PortfolioYield as PortfolioYieldT, PortfolioYieldSnapshot } from "../types";

const data = portfolioYieldJson as unknown as PortfolioYieldT;

function yieldColor(v: number): "buy" | "sell" | undefined {
  if (v > 0) return "buy";
  if (v < 0) return "sell";
  return undefined;
}

function findSnapshot(date: string): PortfolioYieldSnapshot | null {
  return data.snapshots.find((s) => s.date === date) ?? null;
}

export default function PortfolioYield() {
  const [snapshotPick, setSnapshotPick] = useState<string>(DEFAULT_SNAPSHOT_DATE);
  const snap = useMemo(() => findSnapshot(snapshotPick), [snapshotPick]);

  if (!snap) return null;

  return (
    <section className="bg-panel border border-border p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted inline-flex items-baseline gap-2 flex-wrap">
          <span>Estimated portfolio yield</span>
          <span className="text-muted/70 normal-case tracking-normal font-normal">· as of</span>
          <SnapshotSelect value={snapshotPick} onChange={setSnapshotPick} />
        </h2>
        <div className="flex items-baseline gap-3 flex-wrap text-[11px] text-muted">
          <span>
            {snap.tickersCounted.toLocaleString()} tickers · {snap.txCounted.toLocaleString()} tx
          </span>
          {snap.tickersSkipped > 0 && (
            <span>{snap.tickersSkipped} tickers skipped — no price data</span>
          )}
          {snap.txSkipped > 0 && <span>{snap.txSkipped} tx skipped — no price data</span>}
          {snap.txExcludedFuture > 0 && (
            <span>{snap.txExcludedFuture} tx after snapshot — excluded</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        <KpiDollar
          variant="md"
          label="Est. cost"
          value={snap.estCost}
          info={
            <CalcInfo
              title="Estimated cost basis"
              body={
                <>
                  Sum of midpoint dollar amounts across all{" "}
                  <span className="text-buy">purchase</span> transactions
                  across every resolved ticker.
                </>
              }
              formula="Σ buy.mid"
            />
          }
        />
        <KpiDollar
          variant="md"
          label="Est. proceeds"
          value={snap.estProceeds}
          info={
            <CalcInfo
              title="Estimated proceeds"
              body={
                <>
                  Sum of midpoint dollar amounts across all{" "}
                  <span className="text-sell">sale</span> transactions across
                  every resolved ticker.
                </>
              }
              formula="Σ sell.mid"
            />
          }
        />
        <KpiDollar
          variant="md"
          label="Mark-to-market"
          value={snap.estHoldingValue}
          info={
            <CalcInfo
              title="Mark-to-market value"
              body={
                <>
                  Per stock, implied net shares (Σ buy.mid ÷ close_t − Σ
                  sell.mid ÷ close_t) valued at that ticker's close on the
                  snapshot date. Summed across all tickers.
                  <div className="mt-1.5 text-ink">
                    A negative contribution means a ticker shows more dollars
                    sold than bought — i.e. a pre-existing position is being
                    disposed of. Not an actual short.
                  </div>
                </>
              }
              formula="Σ (shares_i × close_i)"
            />
          }
        />
        <KpiDollar
          variant="md"
          label="Est. P&L"
          value={snap.estPnL}
          signed
          color={yieldColor(snap.estPnL)}
          info={
            <CalcInfo
              title="Estimated P&L"
              body="Per-transaction profit/loss using midpoint amounts, summed across every ticker. Each contribution is the change in value between trade date and the chosen snapshot date."
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
        <KpiPct
          variant="md"
          label="Est. yield"
          value={snap.estYieldPct}
          signed
          color={yieldColor(snap.estYieldPct)}
          sub={fmtSigned$(snap.estPnL)}
          subInline
          info={
            <CalcInfo
              title="Estimated yield"
              body={
                <>
                  Total P&amp;L divided by{" "}
                  <span className="font-mono">max(Σ cost, Σ proceeds)</span> —
                  whichever side saw more dollar flow at portfolio scope. Avoids
                  inflating yield when net-seller positions dominate.
                </>
              }
              formula="(P&L ÷ max(cost, proceeds)) × 100%"
            />
          }
        />
        <KpiPct
          variant="md"
          label="Best-case yield"
          value={snap.maxYieldPct}
          signed
          color={yieldColor(snap.maxYieldPct)}
          sub={fmtSigned$(snap.maxPnL)}
          subInline
          info={
            <CalcInfo
              title="Best-case yield"
              body="Each transaction's amount is independently picked at the extreme of its disclosed range that MAXIMISES that tx's contribution to P&L. Summed across every ticker."
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
          value={snap.minYieldPct}
          signed
          color={yieldColor(snap.minYieldPct)}
          sub={fmtSigned$(snap.minPnL)}
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
        <strong className="text-ink">Portfolio-wide.</strong> Every resolved
        ticker's transactions are marked at that stock's close on the chosen
        snapshot date and summed. Tickers without exchange-traded price data
        (money-market funds, unresolved holdings) are excluded.
      </p>
    </section>
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
