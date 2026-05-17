import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ParentSize } from "@visx/responsive";
import { Treemap, hierarchy, treemapSquarify } from "@visx/hierarchy";
import { Group } from "@visx/group";
import type { Stock } from "../types";
import { dataset } from "../lib/dataset";
import { netFlowColor, netFlowTextColor } from "../lib/colors";
import { fmt$, fmtSigned$ } from "../lib/format";

type Leaf = { kind: "leaf"; stock: Stock; value: number };
type Branch = { kind: "branch"; sector: string; children: Node[] };
type Root = { kind: "root"; children: Branch[] };
type Node = Root | Branch | Leaf;

function buildHierarchy(minVolume: number, sectorFilter?: string, dayFilter?: string): Root {
  const bySector: Record<string, Stock[]> = {};
  for (const s of Object.values(dataset.stocks)) {
    if (sectorFilter && s.sector !== sectorFilter) continue;
    let stock: Stock = s;
    if (dayFilter) {
      // Re-aggregate this stock using only transactions on the target day.
      let dayBuy = 0, daySell = 0, dayTx = 0;
      const dayTransactions = [];
      for (const t of s.transactions) {
        if (t.date !== dayFilter) continue;
        if (t.type === "purchase") dayBuy += t.mid;
        else daySell += t.mid;
        dayTx++;
        dayTransactions.push(t);
      }
      if (dayTx === 0) continue;
      stock = {
        ...s,
        totalBuy: dayBuy,
        totalSell: daySell,
        net: dayBuy - daySell,
        txCount: dayTx,
        transactions: dayTransactions,
      };
    }
    const vol = stock.totalBuy + stock.totalSell;
    if (vol < minVolume) continue;
    (bySector[stock.sector] ??= []).push(stock);
  }
  return {
    kind: "root",
    children: Object.entries(bySector)
      .sort((a, b) => {
        const av = a[1].reduce((sum, s) => sum + s.totalBuy + s.totalSell, 0);
        const bv = b[1].reduce((sum, s) => sum + s.totalBuy + s.totalSell, 0);
        return bv - av;
      })
      .map(([sector, stocks]) => ({
        kind: "branch" as const,
        sector,
        children: stocks
          .sort((a, b) => b.totalBuy + b.totalSell - (a.totalBuy + a.totalSell))
          .map((s) => ({ kind: "leaf" as const, stock: s, value: s.totalBuy + s.totalSell })),
      })),
  };
}

type Tooltip = { x: number; y: number; stock: Stock; containerW?: number; containerH?: number } | null;

// Power scale for the min-volume slider: more granularity at low end where most stocks live.
const SLIDER_MAX = 100;
const sliderToVolume = (n: number) => Math.round(Math.pow(n / SLIDER_MAX, 2.4) * 5_000_000);
const volumeToSlider = (volume: number) => Math.round(Math.pow(volume / 5_000_000, 1 / 2.4) * SLIDER_MAX);
const HOME_DEFAULT_MIN_VOLUME = 1_000_000;
const HOME_DEFAULT_SLIDER_POS = volumeToSlider(HOME_DEFAULT_MIN_VOLUME);

export default function SectorHeatmap({
  sectorFilter,
  dayFilter,
  height = 620,
}: {
  sectorFilter?: string;
  dayFilter?: string;
  height?: number;
}) {
  const [sliderPos, setSliderPos] = useState(sectorFilter || dayFilter ? 0 : HOME_DEFAULT_SLIDER_POS);
  const minVolume =
    !sectorFilter && !dayFilter && sliderPos === HOME_DEFAULT_SLIDER_POS
      ? HOME_DEFAULT_MIN_VOLUME
      : sliderToVolume(sliderPos);
  const [tip, setTip] = useState<Tooltip>(null);
  const navigate = useNavigate();

  const root = useMemo(
    () => buildHierarchy(minVolume, sectorFilter, dayFilter),
    [minVolume, sectorFilter, dayFilter]
  );

  const visibleSectors = root.children.length;
  const visibleStocks = root.children.reduce((sum, b) => sum + b.children.length, 0);

  return (
    <section className="bg-panel border border-border p-3 sm:p-5">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-serif text-xl sm:text-2xl text-ink">
            Sector Heatmap
          </h2>
          <div className="text-[11px] sm:text-xs tracking-[0.1em] uppercase text-muted mt-1">
            {visibleStocks} stocks · {visibleSectors} sectors · cell = volume · color = net B/S
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs w-full sm:w-auto">
          <label className="flex items-center gap-2 text-muted w-full sm:w-auto">
            <span className="whitespace-nowrap text-[11px] tracking-[0.15em] uppercase">Min vol:</span>
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              step={1}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="flex-1 sm:flex-none sm:w-40 accent-accent2"
            />
            <span className="text-ink tabular-nums min-w-[56px] text-right font-serif">
              {fmt$(minVolume)}
            </span>
          </label>
        </div>
      </div>

      <div className="relative" style={{ height: `min(${height}px, 75vh)`, minHeight: 320 }}>
        <ParentSize>
          {({ width, height: hh }) =>
            width < 50 ? null : (
              <HeatmapSvg
                width={width}
                height={hh}
                root={root}
                onHover={(t) => setTip(t ? { ...t, containerW: width, containerH: hh } : null)}
                onClick={(s) => navigate(`/stock/${encodeURIComponent(s.ticker)}`)}
                onSectorClick={(sec) => navigate(`/sector/${encodeURIComponent(sec)}`)}
              />
            )
          }
        </ParentSize>

        {tip && (() => {
          const w = tip.containerW ?? 1000;
          const h = tip.containerH ?? 600;
          const TT_W = Math.min(240, w - 16);
          const TT_H = 130, PAD = 12;
          const flipX = tip.x + PAD + TT_W > w;
          const flipY = tip.y + PAD + TT_H > h;
          const left = flipX ? Math.max(8, tip.x - PAD - TT_W) : tip.x + PAD;
          const top  = flipY ? Math.max(8, tip.y - PAD - TT_H) : tip.y + PAD;
          return (
          <div
            className="pointer-events-none absolute bg-panel border border-ink px-3 py-2 text-xs shadow-lg"
            style={{
              left, top,
              zIndex: 20,
              width: TT_W,
            }}
          >
            <div className="font-semibold text-ink">
              {tip.stock.ticker}{" "}
              <span className="font-normal text-muted text-[11px] tracking-wider uppercase">· {tip.stock.sector}</span>
            </div>
            <div className="text-muted truncate text-xs">{tip.stock.name}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-muted">Buy:</span>
              <span className="text-buy text-right tabular-nums">{fmt$(tip.stock.totalBuy)}</span>
              <span className="text-muted">Sell:</span>
              <span className="text-sell text-right tabular-nums">{fmt$(tip.stock.totalSell)}</span>
              <span className="text-muted">Net:</span>
              <span
                className={"text-right tabular-nums " + (tip.stock.net >= 0 ? "text-buy" : "text-sell")}
              >
                {fmtSigned$(tip.stock.net)}
              </span>
              <span className="text-muted"># tx:</span>
              <span className="text-right tabular-nums">{tip.stock.txCount}</span>
            </div>
            <div className="text-muted mt-1 text-[11px] tracking-wider uppercase">Click for details</div>
          </div>
          );
        })()}
      </div>
    </section>
  );
}

function HeatmapSvg({
  width,
  height,
  root,
  onHover,
  onClick,
  onSectorClick,
}: {
  width: number;
  height: number;
  root: Root;
  onHover: (t: Tooltip) => void;
  onClick: (s: Stock) => void;
  onSectorClick: (sector: string) => void;
}) {
  const hier = useMemo(
    () =>
      hierarchy<Node>(root, (d) => {
        if (d.kind === "leaf") return null;
        return d.children;
      }).sum((d) => (d.kind === "leaf" ? d.value : 0)),
    [root]
  );

  return (
    <svg width={width} height={height}>
      <Treemap<Node>
        root={hier as any}
        size={[width, height]}
        tile={treemapSquarify}
        round
        paddingTop={(n: any) => (n.depth === 1 ? 22 : 0)}
        paddingInner={2}
        paddingOuter={2}
      >
        {(treemap) => (
          <Group>
            {treemap
              .descendants()
              .filter((n) => n.depth > 0)
              .map((n, i) => {
                const w = n.x1 - n.x0;
                const h = n.y1 - n.y0;
                const data = n.data;
                if (data.kind === "branch") {
                  const label = data.sector.toUpperCase();
                  // Each char ~7.4px at 11px font + 0.12em letter-spacing.
                  // Padding 12px (6 left + 6 right). Use min(...) to clip.
                  const maxChars = Math.max(0, Math.floor((w - 12) / 7.4));
                  const display = label.length > maxChars
                    ? (maxChars > 1 ? label.slice(0, maxChars - 1) + "…" : "")
                    : label;
                  return (
                    <g key={`b-${i}`} transform={`translate(${n.x0},${n.y0})`}>
                      <rect
                        width={w}
                        height={h}
                        fill="transparent"
                        stroke="#a88a4d"
                        strokeWidth={1.5}
                      />
                      {display && (
                        <text
                          x={6}
                          y={15}
                          fontSize={11}
                          fontWeight={600}
                          fill="#a88a4d"
                          style={{ cursor: "pointer", letterSpacing: "0.12em" }}
                          onClick={() => onSectorClick(data.sector)}
                        >
                          {display}
                          <title>{data.sector}</title>
                        </text>
                      )}
                    </g>
                  );
                }
                if (data.kind === "leaf" && w > 1 && h > 1) {
                  const s = data.stock;
                  const totalVol = s.totalBuy + s.totalSell;
                  const fill = netFlowColor(s.net, totalVol);
                  const txt = netFlowTextColor(s.net, totalVol);
                  const showTicker = w > 40 && h > 20;
                  const showVol = w > 86 && h > 42;
                  const showNet = showVol && h > 60;

                  // Ticker scales gently with area: a ~150×80 tile stays near 12px,
                  // MSFT-sized tiles grow to about 20px. Width safeguard keeps long
                  // tickers like GOOGL from spilling.
                  const SUB_SIZE = 11;
                  const area = w * h;
                  const baseSize = 12 + Math.min(10, Math.max(0, (Math.sqrt(area) - 100) * 0.10));
                  const maxByW = (w - 10) / Math.max(2, s.ticker.length * 0.7);
                  const tickerSize = Math.max(11, Math.min(baseSize, maxByW));

                  const lines: { text: string; size: number; weight: number; opacity: number }[] = [];
                  if (showTicker) lines.push({ text: s.ticker, size: tickerSize, weight: 700, opacity: 1 });
                  if (showVol)    lines.push({ text: fmt$(totalVol), size: SUB_SIZE, weight: 400, opacity: 0.85 });
                  if (showNet)    lines.push({ text: (s.net >= 0 ? "+" : "") + fmt$(s.net), size: SUB_SIZE, weight: 400, opacity: 0.85 });

                  const gap = 3;
                  const blockH = lines.reduce((sum, l) => sum + l.size, 0) + gap * Math.max(0, lines.length - 1);
                  const cx = w / 2;
                  let cursorY = (h - blockH) / 2;
                  return (
                    <g
                      key={`l-${s.ticker}`}
                      transform={`translate(${n.x0},${n.y0})`}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg) return;
                        const r = svg.getBoundingClientRect();
                        onHover({ x: e.clientX - r.left, y: e.clientY - r.top, stock: s });
                      }}
                      onMouseMove={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg) return;
                        const r = svg.getBoundingClientRect();
                        onHover({ x: e.clientX - r.left, y: e.clientY - r.top, stock: s });
                      }}
                      onMouseLeave={() => onHover(null)}
                      onClick={() => onClick(s)}
                    >
                      <rect
                        width={w}
                        height={h}
                        fill={fill}
                        stroke="#fdfaf0"
                        strokeWidth={1}
                      />
                      {lines.map((ln, idx) => {
                        const baseline = cursorY + ln.size * 0.78;
                        cursorY += ln.size + gap;
                        return (
                          <text
                            key={idx}
                            x={cx}
                            y={baseline}
                            fontSize={ln.size}
                            fontWeight={ln.weight}
                            fill={txt}
                            opacity={ln.opacity}
                            textAnchor="middle"
                            style={{ pointerEvents: "none" }}
                          >
                            {ln.text}
                          </text>
                        );
                      })}
                    </g>
                  );
                }
                return null;
              })}
          </Group>
        )}
      </Treemap>
    </svg>
  );
}
