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

function buildHierarchy(minVolume: number, sectorFilter?: string): Root {
  const bySector: Record<string, Stock[]> = {};
  for (const s of Object.values(dataset.stocks)) {
    if (sectorFilter && s.sector !== sectorFilter) continue;
    const vol = s.totalBuy + s.totalSell;
    if (vol < minVolume) continue;
    (bySector[s.sector] ??= []).push(s);
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

type Tooltip = { x: number; y: number; stock: Stock } | null;

// Power scale for the min-volume slider: more granularity at low end where most stocks live.
const SLIDER_MAX = 100;
const sliderToVolume = (n: number) => Math.round(Math.pow(n / SLIDER_MAX, 2.4) * 5_000_000);

export default function SectorHeatmap({ sectorFilter, height = 620 }: { sectorFilter?: string; height?: number }) {
  const [sliderPos, setSliderPos] = useState(sectorFilter ? 0 : 28);
  const minVolume = sliderToVolume(sliderPos);
  const [tip, setTip] = useState<Tooltip>(null);
  const navigate = useNavigate();

  const root = useMemo(() => buildHierarchy(minVolume, sectorFilter), [minVolume, sectorFilter]);

  const visibleSectors = root.children.length;
  const visibleStocks = root.children.reduce((sum, b) => sum + b.children.length, 0);

  return (
    <section className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Sector heatmap
          </h2>
          <div className="text-xs text-muted mt-1">
            {visibleStocks} stocks across {visibleSectors} sectors · cell size = total volume ·
            color = net buy (green) / net sell (red)
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 text-muted">
            <span className="whitespace-nowrap">Min volume:</span>
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              step={1}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="w-40 accent-accent"
            />
            <span className="text-white tabular-nums min-w-[60px] text-right">
              {fmt$(minVolume)}
            </span>
          </label>
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <ParentSize>
          {({ width, height: hh }) =>
            width < 50 ? null : (
              <HeatmapSvg
                width={width}
                height={hh}
                root={root}
                onHover={setTip}
                onClick={(s) => navigate(`/stock/${encodeURIComponent(s.ticker)}`)}
                onSectorClick={(sec) => navigate(`/sector/${encodeURIComponent(sec)}`)}
              />
            )
          }
        </ParentSize>

        {tip && (
          <div
            className="pointer-events-none absolute bg-panel2 border border-border rounded-md px-3 py-2 text-xs shadow-xl"
            style={{
              left: Math.min(tip.x + 12, 1000),
              top: tip.y + 12,
              zIndex: 20,
              maxWidth: 260,
            }}
          >
            <div className="font-semibold text-white">
              {tip.stock.ticker}{" "}
              <span className="font-normal text-muted">· {tip.stock.sector}</span>
            </div>
            <div className="text-muted truncate">{tip.stock.name}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-muted">Buy:</span>
              <span className="text-buy text-right">{fmt$(tip.stock.totalBuy)}</span>
              <span className="text-muted">Sell:</span>
              <span className="text-sell text-right">{fmt$(tip.stock.totalSell)}</span>
              <span className="text-muted">Net:</span>
              <span
                className={"text-right " + (tip.stock.net >= 0 ? "text-buy" : "text-sell")}
              >
                {fmtSigned$(tip.stock.net)}
              </span>
              <span className="text-muted"># tx:</span>
              <span className="text-right">{tip.stock.txCount}</span>
            </div>
            <div className="text-muted mt-1 text-[10px]">Click to view all transactions</div>
          </div>
        )}
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
        paddingTop={(n: any) => (n.depth === 1 ? 20 : 0)}
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
                  return (
                    <g key={`b-${i}`} transform={`translate(${n.x0},${n.y0})`}>
                      <rect
                        width={w}
                        height={h}
                        fill="transparent"
                        stroke="#0b0f17"
                        strokeWidth={2}
                      />
                      <text
                        x={6}
                        y={14}
                        fontSize={11}
                        fontWeight={700}
                        fill="#cbd5e1"
                        style={{ cursor: "pointer", letterSpacing: "0.04em" }}
                        onClick={() => onSectorClick(data.sector)}
                      >
                        {data.sector.toUpperCase()}
                      </text>
                    </g>
                  );
                }
                if (data.kind === "leaf" && w > 1 && h > 1) {
                  const s = data.stock;
                  const totalVol = s.totalBuy + s.totalSell;
                  const fill = netFlowColor(s.net, totalVol);
                  const txt = netFlowTextColor(s.net, totalVol);
                  const showTicker = w > 36 && h > 18;
                  const showVol = w > 80 && h > 38;
                  return (
                    <g
                      key={`l-${s.ticker}`}
                      transform={`translate(${n.x0},${n.y0})`}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) =>
                        onHover({
                          x: e.nativeEvent.offsetX + n.x0,
                          y: e.nativeEvent.offsetY + n.y0,
                          stock: s,
                        })
                      }
                      onMouseMove={(e) =>
                        onHover({
                          x: e.nativeEvent.offsetX + n.x0,
                          y: e.nativeEvent.offsetY + n.y0,
                          stock: s,
                        })
                      }
                      onMouseLeave={() => onHover(null)}
                      onClick={() => onClick(s)}
                    >
                      <rect
                        width={w}
                        height={h}
                        fill={fill}
                        stroke="#0b0f17"
                        strokeWidth={1}
                      />
                      {showTicker && (
                        <text
                          x={4}
                          y={14}
                          fontSize={11}
                          fontWeight={700}
                          fill={txt}
                          style={{ pointerEvents: "none" }}
                        >
                          {s.ticker}
                        </text>
                      )}
                      {showVol && (
                        <text
                          x={4}
                          y={28}
                          fontSize={10}
                          fill={txt}
                          opacity={0.85}
                          style={{ pointerEvents: "none" }}
                        >
                          {fmt$(totalVol)}
                        </text>
                      )}
                      {showVol && h > 54 && (
                        <text
                          x={4}
                          y={42}
                          fontSize={10}
                          fill={txt}
                          opacity={0.85}
                          style={{ pointerEvents: "none" }}
                        >
                          {s.net >= 0 ? "+" : ""}
                          {fmt$(s.net)}
                        </text>
                      )}
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
