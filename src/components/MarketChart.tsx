import { Fragment, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { Transaction } from "../types";
import { fmt$ } from "../lib/format";
import CompanyLogo from "./CompanyLogo";

// Pinned window: Dec 22 2025 → Apr 15 2026 active filing period plus
// ~5 trade-day buffer on each side.
const VISIBLE_FROM = "2025-12-22" as Time;
const VISIBLE_TO = "2026-04-15" as Time;

type Badge = {
  date: string;
  x: number;
  yBuy: number | null;
  ySell: number | null;
  buys: number;
  sells: number;
  buyVol: number;
  sellVol: number;
  // Final gap from the candle's anchor to the badge edge, after collision
  // avoidance. Defaults to 22 when no collision is detected.
  buyGap: number;
  sellGap: number;
};

// Three shade tiers + a gold halo for the very largest trades:
//   < $100K       light shade
//   $100K – $1M   mid (brand) shade
//   $1M – $10M    dark shade
//   > $10M        dark shade + gold ring + soft gold halo
type TierKind = "light" | "mid" | "dark" | "dark-halo";
type Tier = { upTo: number; kind: TierKind; label: string };
const BUY_LIGHT = "#5b9a5b";
const BUY_MID = "#3a7a3a"; // brand
const BUY_DARK = "#1f5d1f";
const SELL_LIGHT = "#b85050";
const SELL_MID = "#a52a2a"; // brand
const SELL_DARK = "#7a1818";
// Turnaround = a single day with both buy and sell activity. Rendered as a
// single yellow "T" badge instead of splitting into a B and an S. Yellow
// comes from buy-green + sell-red additive mixing; tones pulled toward
// mustard / dark amber so they sit calmly on the cream background.
const TURN_LIGHT = "#d6ac35";
const TURN_MID = "#ad880f";
const TURN_DARK = "#7c5d10";
const BASE_SHADOW = "0 1px 2px rgba(0,0,0,0.2)";
const TIERS: Tier[] = [
  { upTo: 1e5,      kind: "light",     label: "< $100K" },
  { upTo: 1e6,      kind: "mid",       label: "$100K – $1M" },
  { upTo: 1e7,      kind: "dark",      label: "$1M – $10M" },
  { upTo: Infinity, kind: "dark-halo", label: "> $10M" },
];
function tierFor(vol: number): Tier {
  for (const t of TIERS) if (vol < t.upTo) return t;
  return TIERS[TIERS.length - 1];
}

// Detect a turnaround day (both buys and sells present) and pick the
// dominant direction. Direction follows the larger side by volume; ties
// resolve to buy.
function turnaroundFor(b: {
  buys: number;
  sells: number;
  buyVol: number;
  sellVol: number;
}): { dir: "buy" | "sell"; netVol: number } | null {
  if (b.buys === 0 || b.sells === 0) return null;
  const netVol = Math.abs(b.buyVol - b.sellVol);
  const dir: "buy" | "sell" = b.buyVol >= b.sellVol ? "buy" : "sell";
  return { dir, netVol };
}

type BadgeStyle = {
  background: string;
  color: string;
  boxShadow: string;
  tail: string;      // colour for the triangle tail (when shown)
  connector: string; // colour for the dotted connector line
  size: number;      // badge edge length in px
  fontSize: number;  // letter font size in px
  borderRadius: string;
  showTail: boolean; // off for round badges
  className?: string;
};

function styleFor(type: "buy" | "sell" | "turn", tier: Tier): BadgeStyle {
  const light = type === "buy" ? BUY_LIGHT : type === "sell" ? SELL_LIGHT : TURN_LIGHT;
  const mid = type === "buy" ? BUY_MID : type === "sell" ? SELL_MID : TURN_MID;
  const dark = type === "buy" ? BUY_DARK : type === "sell" ? SELL_DARK : TURN_DARK;
  const dot =
    type === "buy"
      ? "rgba(58,122,58,0.55)"
      : type === "sell"
        ? "rgba(165,42,42,0.55)"
        : "rgba(173,136,15,0.7)";
  const fill = tier.kind === "light" ? light : tier.kind === "mid" ? mid : dark;
  // Dark tier gets a thin gold ring; halo tier adds a soft outer halo on top
  // plus a breathing animation (driven by .badge-halo-pulse in index.css).
  const shadow =
    tier.kind === "dark-halo"
      ? `0 0 0 1.5px #d1b371, 0 0 0 4.5px rgba(209,179,113,0.35), ${BASE_SHADOW}`
      : tier.kind === "dark"
        ? `0 0 0 1.5px #d1b371, ${BASE_SHADOW}`
        : BASE_SHADOW;
  // Light tier reads as "less weighty" purely by its fill + fully-round shape
  // (no tail). All tiers share the same edge length so the legend and chart
  // markers stay visually consistent.
  const isLight = tier.kind === "light";
  return {
    background: fill,
    color: "white",
    boxShadow: shadow,
    tail: fill,
    connector: dot,
    size: 18,
    fontSize: 10,
    borderRadius: isLight ? "50%" : "6px",
    showTail: !isLight,
    className: tier.kind === "dark-halo" ? "badge-halo-pulse" : undefined,
  };
}

async function fetchPrices(symbol: string): Promise<CandlestickData[]> {
  const res = await fetch(`/prices/${encodeURIComponent(symbol)}.json`);
  if (res.status === 404) throw new Error("No price data on file.");
  if (!res.ok) throw new Error(`prices ${res.status}`);
  const json = await res.json();
  return (json.candles ?? []) as CandlestickData[];
}

export default function MarketChart({
  symbol,
  name,
  transactions,
}: {
  symbol: string;
  name: string;
  transactions: Transaction[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    setBadges([]);

    const container = containerRef.current;
    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: "#fdfaf0" },
        textColor: "#24201a",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: "rgba(36,32,26,0.05)" },
        horzLines: { color: "rgba(36,32,26,0.05)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: "#ddd2b0",
        timeVisible: false,
        secondsVisible: false,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: { borderColor: "#ddd2b0" },
      handleScroll: false,
      handleScale: false,
      kineticScroll: { mouse: false, touch: false },
    });

    const series: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      // Hollow-candle convention: up days drawn as outlined-only candles, down
      // days filled. Borders + wicks always carry the brand colours.
      upColor: "rgba(0,0,0,0)",
      downColor: "#a52a2a",
      borderUpColor: "#3a7a3a",
      borderDownColor: "#a52a2a",
      wickUpColor: "#3a7a3a",
      wickDownColor: "#a52a2a",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Aggregate transactions per date for both tooltip and badge rendering.
    const txByDate = new Map<string, Transaction[]>();
    const dailyByDate = new Map<
      string,
      { buys: number; sells: number; buyVol: number; sellVol: number }
    >();
    for (const t of transactions) {
      const arr = txByDate.get(t.date) ?? [];
      arr.push(t);
      txByDate.set(t.date, arr);
      const d = dailyByDate.get(t.date) ?? { buys: 0, sells: 0, buyVol: 0, sellVol: 0 };
      if (t.type === "purchase") {
        d.buys += 1;
        d.buyVol += t.mid;
      } else {
        d.sells += 1;
        d.sellVol += t.mid;
      }
      dailyByDate.set(t.date, d);
    }

    let candleLookup = new Map<string, CandlestickData>();
    let lastSerialised = "";

    function computeBadges(retries = 0) {
      if (cancelled) return;
      const out: Badge[] = [];
      let fullyResolved = 0;
      for (const [date, e] of dailyByDate) {
        const candle = candleLookup.get(date);
        if (!candle) continue;
        const x = chart.timeScale().timeToCoordinate(date as Time);
        if (x == null) continue;
        // yBuy = bottom of bar (low) → badge sits below the wick.
        // ySell = top of bar (high) → badge sits above the wick.
        const yBuy = e.buys > 0 ? series.priceToCoordinate(candle.low) : null;
        const ySell = e.sells > 0 ? series.priceToCoordinate(candle.high) : null;
        const needBuy = e.buys > 0, needSell = e.sells > 0;
        const buyReady = !needBuy || yBuy != null;
        const sellReady = !needSell || ySell != null;
        if (buyReady && sellReady) fullyResolved++;
        out.push({
          date, x, yBuy, ySell,
          buys: e.buys, sells: e.sells,
          buyVol: e.buyVol, sellVol: e.sellVol,
          buyGap: 22,
          sellGap: 22,
        });
      }
      // Chart sometimes returns null coordinates while it's still laying out
      // after setVisibleRange. Retry across frames until everything resolves.
      if (fullyResolved < dailyByDate.size && retries < 20) {
        requestAnimationFrame(() => computeBadges(retries + 1));
        return;
      }

      // ---- Phase 2: collision-aware gap assignment ---------------------
      // Resolve overlaps between badges (and between badges and any candle
      // body/wick) by pushing colliding badges further from their candle.
      // Approximate badge bounding box used for hit-testing — generous enough
      // to include the halo and the ×N subscript on the widest tier.
      const BADGE_W = 28;
      const BADGE_H = 22;
      const STEP = 6;
      const MIN_GAP = 22;
      const MAX_GAP = 120;

      // Build pixel rects for every candle in the visible series so badges
      // can avoid sitting on top of adjacent bars.
      const candleRects: { x: number; yTop: number; yBottom: number }[] = [];
      for (const c of candleLookup.values()) {
        const cx = chart.timeScale().timeToCoordinate(c.time as Time);
        const cyTop = series.priceToCoordinate(c.high);
        const cyBottom = series.priceToCoordinate(c.low);
        if (cx == null || cyTop == null || cyBottom == null) continue;
        candleRects.push({ x: cx, yTop: cyTop, yBottom: cyBottom });
      }

      function findGap(
        x: number,
        anchorY: number,
        isBuy: boolean,
        placed: { x: number; yTop: number; yBottom: number }[]
      ): number {
        let gap = MIN_GAP;
        while (gap <= MAX_GAP) {
          const yTop = isBuy ? anchorY + gap : anchorY - gap - BADGE_H;
          const yBottom = yTop + BADGE_H;
          const xL = x - BADGE_W / 2;
          const xR = x + BADGE_W / 2;

          let collides = false;
          // Badge↔badge overlap on the same side (buy vs sell are independent).
          for (const p of placed) {
            const pxL = p.x - BADGE_W / 2;
            const pxR = p.x + BADGE_W / 2;
            if (xL < pxR && xR > pxL && yTop < p.yBottom && yBottom > p.yTop) {
              collides = true;
              break;
            }
          }
          // Badge↔candle overlap. Skip the badge's own candle (same x),
          // since by construction the badge sits below/above it.
          if (!collides) {
            for (const c of candleRects) {
              const dx = Math.abs(c.x - x);
              if (dx < 1 || dx >= BADGE_W / 2 + 2) continue;
              if (yTop < c.yBottom && yBottom > c.yTop) {
                collides = true;
                break;
              }
            }
          }
          if (!collides) return gap;
          gap += STEP;
        }
        return gap;
      }

      // Left→right placement order so dense clusters fan outward predictably.
      out.sort((a, b) => a.x - b.x);
      const placedBuys: { x: number; yTop: number; yBottom: number }[] = [];
      const placedSells: { x: number; yTop: number; yBottom: number }[] = [];
      for (const b of out) {
        // Turnaround days collapse into one badge on the dominant side, so
        // the other side is skipped for collision purposes.
        const turn = turnaroundFor(b);
        const skipBuy = turn != null && turn.dir !== "buy";
        const skipSell = turn != null && turn.dir !== "sell";
        if (!skipBuy && b.buys > 0 && b.yBuy != null) {
          b.buyGap = findGap(b.x, b.yBuy, true, placedBuys);
          const yTop = b.yBuy + b.buyGap;
          placedBuys.push({ x: b.x, yTop, yBottom: yTop + BADGE_H });
        }
        if (!skipSell && b.sells > 0 && b.ySell != null) {
          b.sellGap = findGap(b.x, b.ySell, false, placedSells);
          const yBottom = b.ySell - b.sellGap;
          placedSells.push({ x: b.x, yTop: yBottom - BADGE_H, yBottom });
        }
      }

      // Skip identical updates so we don't thrash React state during resize.
      const sig = out
        .map((b) => `${b.date}|${b.x}|${b.yBuy}|${b.ySell}|${b.buyVol}|${b.sellVol}|${b.buyGap}|${b.sellGap}`)
        .join(";");
      if (sig === lastSerialised) return;
      lastSerialised = sig;
      setBadges(out);
    }

    function onMove(param: MouseEventParams<Time>) {
      const tip = tooltipRef.current;
      if (!tip) return;
      if (!param.time || !param.point || !param.seriesData.size) {
        tip.style.display = "none";
        return;
      }
      const candle = param.seriesData.get(series) as CandlestickData | undefined;
      if (!candle) {
        tip.style.display = "none";
        return;
      }
      const date = param.time as string;
      const dayTx = txByDate.get(date) ?? [];

      const ohlcRow = (label: string, value: number) =>
        `<span class="text-muted">${label}</span>` +
        `<span class="tabular-nums text-ink">${value.toFixed(2)}</span>`;

      const ohlc =
        `<div class="grid grid-cols-[auto_auto] gap-x-2 gap-y-0.5 text-[11px]">` +
        ohlcRow("Open", candle.open) +
        ohlcRow("High", candle.high) +
        ohlcRow("Low", candle.low) +
        ohlcRow("Close", candle.close) +
        `</div>`;

      const txRows = dayTx.length
        ? `<div class="mt-2 pt-2 border-t border-border space-y-0.5">` +
          dayTx
            .map((t) => {
              const c = t.type === "purchase" ? "text-buy" : "text-sell";
              const label = t.type === "purchase" ? "Buy" : "Sell";
              return `<div class="text-[11px] flex justify-between gap-3">` +
                `<span class="${c}">${label}</span>` +
                `<span class="tabular-nums">${fmt$(t.mid)}</span>` +
                `</div>`;
            })
            .join("") +
          `</div>`
        : "";

      tip.innerHTML =
        `<div class="font-mono text-xs text-ink font-semibold">${date}</div>` +
        ohlc +
        txRows;
      tip.style.display = "block";

      const W = tip.offsetWidth || 180;
      const H = tip.offsetHeight || 80;
      const margin = 12;
      const { x, y } = param.point;
      let left = x + margin;
      if (left + W > container.clientWidth - 8) left = x - margin - W;
      let top = y + margin;
      if (top + H > container.clientHeight - 8) top = y - margin - H;
      tip.style.left = `${Math.max(8, left)}px`;
      tip.style.top = `${Math.max(8, top)}px`;
    }
    chart.subscribeCrosshairMove(onMove);

    // Recompute badge positions whenever the chart's visible range changes
    // (including the initial setVisibleRange below).
    const onRangeChange = () => requestAnimationFrame(() => computeBadges());
    chart.timeScale().subscribeVisibleTimeRangeChange(onRangeChange);

    fetchPrices(symbol)
      .then((candles) => {
        if (cancelled) return;
        if (candles.length === 0) {
          setError("No price data available for this symbol.");
          setLoading(false);
          return;
        }
        series.setData(candles);
        candleLookup = new Map(candles.map((c) => [c.time as string, c]));
        chart.timeScale().setVisibleRange({ from: VISIBLE_FROM, to: VISIBLE_TO });
        setLoading(false);
        // setVisibleRange triggers subscribeVisibleTimeRangeChange → computeBadges,
        // but kick a frame in case the change is no-op for an already-correct range.
        requestAnimationFrame(() => computeBadges());
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Couldn't load market data.");
        setLoading(false);
      });

    const ro = new ResizeObserver(() => {
      if (cancelled) return;
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      requestAnimationFrame(() => computeBadges());
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRangeChange);
      chart.remove();
    };
  }, [symbol, transactions]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Buy/Sell badges — HTML overlay computed from chart pixel coordinates. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {badges.map((b) => {
          const turn = turnaroundFor(b);
          if (turn) {
            const y = turn.dir === "buy" ? b.yBuy : b.ySell;
            if (y == null) return null;
            const gap = turn.dir === "buy" ? b.buyGap : b.sellGap;
            return (
              <TxBadge
                key={b.date}
                x={b.x}
                y={y}
                type="turn"
                dir={turn.dir}
                count={b.buys + b.sells}
                vol={turn.netVol}
                gap={gap}
              />
            );
          }
          return (
            <Fragment key={b.date}>
              {b.buys > 0 && b.yBuy != null && (
                <TxBadge x={b.x} y={b.yBuy} type="buy" dir="buy" count={b.buys} vol={b.buyVol} gap={b.buyGap} />
              )}
              {b.sells > 0 && b.ySell != null && (
                <TxBadge x={b.x} y={b.ySell} type="sell" dir="sell" count={b.sells} vol={b.sellVol} gap={b.sellGap} />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Chart header: logo + ticker + name */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 pointer-events-none">
        <CompanyLogo
          ticker={symbol}
          alt=""
          className="w-9 h-9 object-contain bg-bg rounded-sm border border-border p-0.5"
        />
        <div className="leading-tight">
          <div className="font-mono font-bold text-base sm:text-lg text-ink tracking-wider">
            {symbol}
          </div>
          <div className="text-[11px] sm:text-xs text-muted font-serif italic max-w-[260px] truncate">
            {name}
          </div>
        </div>
      </div>

      <div
        ref={tooltipRef}
        className="absolute bg-panel border border-ink shadow-lg px-3 py-2 pointer-events-none z-20"
        style={{ display: "none", minWidth: 160 }}
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.12em] uppercase text-muted pointer-events-none">
          Loading market data…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted px-4 text-center">
          {error}{" "}
          <a
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent2 underline ml-1"
          >
            View on Yahoo →
          </a>
        </div>
      )}
    </div>
  );
}

// One-line volume legend. Each tier renders as a single swatch split down the
// middle (left half = buy, right half = sell, each with its B/S letter)
// followed by the tier's dollar range.
export function MarketChartLegend() {
  // Largest tier first so the eye sees the most "expensive" badge style up
  // front. Vertical padding leaves room for the >$10M tier's halo without
  // clipping (overflow-x:auto would otherwise also clip box-shadow on y).
  const ordered = [...TIERS].reverse();
  return (
    <div className="flex items-center gap-4 text-[10px] tracking-[0.12em] uppercase text-muted whitespace-nowrap overflow-x-clip overflow-y-visible pt-2 pb-0">
      <span>Daily volume</span>
      {ordered.map((t) => (
        <span key={t.label} className="inline-flex items-center gap-1.5">
          <TierSwatch tier={t} />
          <span className="font-mono normal-case tracking-normal text-[10px]">
            {t.label}
          </span>
        </span>
      ))}
      <ChartInfo />
    </div>
  );
}

function TierSwatch({ tier }: { tier: Tier }) {
  const buy = styleFor("buy", tier);
  const sell = styleFor("sell", tier);
  // Legend-only swatch: B and S packed tighter than on-chart markers via a
  // narrower aspect ratio. Vertical split (left half = buy, right half = sell).
  const w = Math.round(buy.size * 1.4);
  const h = buy.size;
  return (
    <div
      className={buy.className ?? ""}
      style={{
        width: w,
        height: h,
        borderRadius: buy.borderRadius,
        overflow: "hidden",
        boxShadow: buy.boxShadow,
        display: "inline-flex",
      }}
      title={tier.label}
    >
      <div
        className="flex items-center justify-center font-mono font-bold text-white"
        style={{ flex: 1, background: buy.background, fontSize: buy.fontSize, lineHeight: 1 }}
      >
        B
      </div>
      <div
        className="flex items-center justify-center font-mono font-bold text-white"
        style={{ flex: 1, background: sell.background, fontSize: sell.fontSize, lineHeight: 1 }}
      >
        S
      </div>
    </div>
  );
}

function ChartInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="How to read this chart"
        className="w-5 h-5 rounded-full border border-border bg-panel text-muted hover:text-ink hover:border-ink flex items-center justify-center text-[10px] font-serif italic"
      >
        i
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-panel border border-ink shadow-lg p-3 text-xs leading-relaxed text-ink normal-case tracking-normal whitespace-normal z-30">
          <div className="font-semibold mb-2 text-sm">How to read this chart</div>
          <ul className="space-y-1.5 text-muted">
            <li>
              <span className="font-mono text-buy">B</span> below a candle marks a{" "}
              <span className="text-buy">buy</span>;{" "}
              <span className="font-mono text-sell">S</span> above marks a{" "}
              <span className="text-sell">sell</span>.
            </li>
            <li>
              A yellow{" "}
              <span className="font-mono" style={{ color: TURN_DARK }}>T</span>{" "}
              marks a <strong>turnaround</strong> day — both buys and sells
              happened. Position follows the larger side; size is{" "}
              <em>net</em> volume (|buy − sell|).
            </li>
            <li>
              The day's aggregated dollar volume is read from the marker
              shade — three steps from light to dark, with a gold halo for
              the very largest trades:
              <ul className="mt-1 ml-1 space-y-0.5">
                <li>· <strong>Light</strong> — under $100K</li>
                <li>· <strong>Mid</strong> — $100K to $1M</li>
                <li>
                  · <strong>Dark + <span style={{ color: "#a88a4d" }}>gold
                  ring</span></strong> — $1M to $10M
                </li>
                <li>
                  · <strong>Dark + <span style={{ color: "#a88a4d" }}>gold
                  ring &amp; halo</span></strong> — over $10M
                </li>
              </ul>
            </li>
            <li>
              A small dark pill on the marker's corner (e.g.{" "}
              <span className="font-mono">2</span>) shows the transaction
              count for that day; values are summed.
            </li>
            <li>Hover any bar to see OHLC and the day's transactions.</li>
          </ul>
        </div>
      )}
    </span>
  );
}

function TxBadge({
  x,
  y,
  type,
  dir,
  count,
  vol,
  gap,
}: {
  x: number;
  y: number;
  type: "buy" | "sell" | "turn";
  // Position direction: "buy" sits below the candle low, "sell" sits above
  // the candle high. For "turn" badges this is the dominant side; for
  // "buy" / "sell" it matches the type.
  dir: "buy" | "sell";
  count: number;
  vol: number;
  gap: number;
}) {
  const isBuy = dir === "buy";
  const tier = tierFor(vol);
  const s = styleFor(type, tier);
  // Distance from the candle's wick to the edge of the badge.
  // Defaults to 22 but can be increased by the collision-resolver to keep
  // adjacent badges and bars from overlapping.
  const GAP = gap;
  const TAIL = 4;
  // No tail → dotted line extends right up to the badge edge (with a 1px
  // breathing gap). With tail → leave TAIL px clear for the triangle.
  const LINE = s.showTail ? GAP - TAIL : GAP - 1;

  // Zero-size anchor pinned at the bar's low (buy) or high (sell).
  const anchor: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: 0,
    height: 0,
  };
  // Pale dotted line bridging anchor → triangle tail.
  const connector: React.CSSProperties = {
    position: "absolute",
    left: -0.5,
    width: 0,
    height: LINE,
    borderLeft: `1px dotted ${s.connector}`,
    ...(isBuy ? { top: 0 } : { bottom: 0 }),
  };
  // Triangle tail attached to the badge, pointing toward the candle.
  const tail: React.CSSProperties = {
    position: "absolute",
    left: 0,
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: `${TAIL}px solid transparent`,
    borderRight: `${TAIL}px solid transparent`,
    ...(isBuy
      ? { top: LINE, borderBottom: `${TAIL}px solid ${s.tail}` }
      : { bottom: LINE, borderTop: `${TAIL}px solid ${s.tail}` }),
  };
  const badgeWrap: React.CSSProperties = {
    position: "absolute",
    left: 0,
    transform: "translateX(-50%)",
    ...(isBuy ? { top: GAP } : { bottom: GAP }),
  };
  return (
    <div style={anchor}>
      <div style={connector} />
      <div style={badgeWrap}>
        <div
          style={{ position: "relative", width: s.size, height: s.size }}
          title={
            type === "turn"
              ? `Turnaround · ${count} transactions · net ${tier.label}`
              : `${count} ${isBuy ? "buy" : "sell"}${count > 1 ? "s" : ""} · ${tier.label}`
          }
        >
          <div
            className={
              "font-mono font-bold tracking-tight flex items-center justify-center " +
              (s.className ?? "")
            }
            style={{
              background: s.background,
              color: s.color,
              width: s.size,
              height: s.size,
              fontSize: s.fontSize,
              lineHeight: 1,
              borderRadius: s.borderRadius,
              boxShadow: s.boxShadow,
            }}
          >
            {type === "turn" ? "T" : isBuy ? "B" : "S"}
          </div>
          {count > 1 && (
            <span
              className="font-mono font-bold flex items-center justify-center"
              style={{
                position: "absolute",
                // Sit on the side opposite the candle so the pill never crowds
                // the connector / tail: buys (badge below) → bottom-right,
                // sells (badge above) → top-right. Turnarounds follow the
                // dominant direction via `isBuy`.
                ...(isBuy ? { bottom: -4 } : { top: -4 }),
                right: -4,
                minWidth: 11,
                height: 11,
                padding: "0 2px",
                borderRadius: 999,
                background: s.background,
                color: s.color,
                fontSize: 7,
                lineHeight: 1,
                border: "1px solid #fdfaf0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
              }}
            >
              {count}
            </span>
          )}
        </div>
      </div>
      {/* Tail rendered AFTER badge so it sits on top of the badge's ring,
          giving a clean speech-bubble outline rather than a clipped ring. */}
      {s.showTail && <div style={tail} />}
    </div>
  );
}
