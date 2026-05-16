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

// Pinned window: mid-Dec 2025 → mid-Apr 2026 covers the active filing period
// with about two weeks of context on each side.
const VISIBLE_FROM = "2025-12-15" as Time;
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

function styleFor(type: "buy" | "sell", tier: Tier): BadgeStyle {
  const light = type === "buy" ? BUY_LIGHT : SELL_LIGHT;
  const mid = type === "buy" ? BUY_MID : SELL_MID;
  const dark = type === "buy" ? BUY_DARK : SELL_DARK;
  const dot = type === "buy"
    ? "rgba(58,122,58,0.55)"
    : "rgba(165,42,42,0.55)";
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
        });
      }
      // Chart sometimes returns null coordinates while it's still laying out
      // after setVisibleRange. Retry across frames until everything resolves.
      if (fullyResolved < dailyByDate.size && retries < 20) {
        requestAnimationFrame(() => computeBadges(retries + 1));
        return;
      }
      // Skip identical updates so we don't thrash React state during resize.
      const sig = out
        .map((b) => `${b.date}|${b.x}|${b.yBuy}|${b.ySell}|${b.buyVol}|${b.sellVol}`)
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
        {badges.map((b) => (
          <Fragment key={b.date}>
            {b.buys > 0 && b.yBuy != null && (
              <TxBadge x={b.x} y={b.yBuy} type="buy" count={b.buys} vol={b.buyVol} />
            )}
            {b.sells > 0 && b.ySell != null && (
              <TxBadge x={b.x} y={b.ySell} type="sell" count={b.sells} vol={b.sellVol} />
            )}
          </Fragment>
        ))}
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

      {/* Info popover */}
      <ChartInfo />

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
    </div>
  );
}

function TierSwatch({ tier }: { tier: Tier }) {
  const buy = styleFor("buy", tier);
  const sell = styleFor("sell", tier);
  // Width is ~1.8x the height so each half is wide enough for a readable
  // letter. Height tracks the tier's per-shape size, so the light tier stays
  // smaller and rounder than the others.
  const w = Math.round(buy.size * 1.8);
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
    <div
      className="absolute top-3 right-3 z-20"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="How to read this chart"
        className="w-6 h-6 rounded-full border border-border bg-panel text-muted hover:text-ink hover:border-ink flex items-center justify-center text-xs font-serif italic"
      >
        i
      </button>
      {open && (
        <div className="absolute top-7 right-0 w-72 bg-panel border border-ink shadow-lg p-3 text-xs leading-relaxed text-ink">
          <div className="font-semibold mb-2 text-sm">How to read this chart</div>
          <ul className="space-y-1.5 text-muted">
            <li>
              <span className="font-mono text-buy">B</span> below a candle marks a{" "}
              <span className="text-buy">buy</span>;{" "}
              <span className="font-mono text-sell">S</span> above marks a{" "}
              <span className="text-sell">sell</span>.
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
              A small subscript (e.g. <span className="font-mono">B×3</span>)
              means multiple transactions happened that day; the value is summed.
            </li>
            <li>Hover any bar to see OHLC and the day's transactions.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function TxBadge({
  x,
  y,
  type,
  count,
  vol,
}: {
  x: number;
  y: number;
  type: "buy" | "sell";
  count: number;
  vol: number;
}) {
  const isBuy = type === "buy";
  const tier = tierFor(vol);
  const s = styleFor(type, tier);
  // Distance from the candle's wick to the edge of the badge.
  const GAP = 22;
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
          className={
            "font-mono font-bold tracking-tight flex items-center justify-center " +
            (s.className ?? "")
          }
          style={{
            background: s.background,
            color: s.color,
            width: count > 1 ? "auto" : s.size,
            height: s.size,
            minWidth: s.size,
            padding: count > 1 ? "0 4px" : 0,
            fontSize: s.fontSize,
            lineHeight: 1,
            borderRadius: s.borderRadius,
            boxShadow: s.boxShadow,
          }}
          title={`${count} ${isBuy ? "buy" : "sell"}${count > 1 ? "s" : ""} · ${tier.label}`}
        >
          {isBuy ? "B" : "S"}
          {count > 1 ? (
            <sub style={{ fontSize: Math.max(8, s.fontSize - 2), marginLeft: 1 }}>
              ×{count}
            </sub>
          ) : null}
        </div>
      </div>
      {/* Tail rendered AFTER badge so it sits on top of the badge's ring,
          giving a clean speech-bubble outline rather than a clipped ring. */}
      {s.showTail && <div style={tail} />}
    </div>
  );
}
