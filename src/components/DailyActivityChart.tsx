import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { dataset } from "../lib/dataset";
import { fmt$ } from "../lib/format";

type Mode = "bs" | "net";

type Row = {
  date: string;
  // Buy / Sell columns (sell is plotted below zero)
  buy: number;
  buyRange: [number, number];   // [low, high], both >= 0
  sell: number;                  // <= 0
  sellRange: [number, number];   // both <= 0; sellRange[0] is more negative
  // Net column
  net: number;                   // buy + sell (sell is negative → effectively buy − |sell|)
  netRange: [number, number];    // [worst, best]
  // Counts for the tooltip
  buyCount: number;
  sellCount: number;
};

function addDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function DailyActivityChart({ sector }: { sector?: string }) {
  const [mode, setMode] = useState<Mode>("bs");
  const navigate = useNavigate();

  const data = useMemo<Row[]>(() => {
    const byDay: Record<
      string,
      {
        buy: number; buyLow: number; buyHigh: number; buyCount: number;
        sell: number; sellLow: number; sellHigh: number; sellCount: number;
      }
    > = {};

    const stocks = sector
      ? Object.values(dataset.stocks).filter((s) => s.sector === sector)
      : Object.values(dataset.stocks);
    for (const s of stocks) {
      for (const t of s.transactions) {
        const r = (byDay[t.date] ??= {
          buy: 0, buyLow: 0, buyHigh: 0, buyCount: 0,
          sell: 0, sellLow: 0, sellHigh: 0, sellCount: 0,
        });
        if (t.type === "purchase") {
          r.buy += t.mid;
          r.buyLow += t.low;
          r.buyHigh += t.high;
          r.buyCount += 1;
        } else {
          r.sell -= t.mid;
          r.sellLow -= t.high;
          r.sellHigh -= t.low;
          r.sellCount += 1;
        }
      }
    }

    const dates = Object.keys(byDay).sort();
    if (!dates.length) return [];

    const out: Row[] = [];
    for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDay(d)) {
      const r = byDay[d];
      const buy = r?.buy ?? 0;
      const buyLow = r?.buyLow ?? 0;
      const buyHigh = r?.buyHigh ?? 0;
      const sell = r?.sell ?? 0;
      const sellLow = r?.sellLow ?? 0;     // more negative
      const sellHigh = r?.sellHigh ?? 0;   // less negative
      // Net = buy + sell (sell is already negative for plot)
      // worst net = smallest buy with biggest sell = buyLow + sellLow
      // best net  = biggest buy with smallest sell = buyHigh + sellHigh
      out.push({
        date: d,
        buy, buyRange: [buyLow, buyHigh],
        sell, sellRange: [sellLow, sellHigh],
        net: buy + sell,
        netRange: [buyLow + sellLow, buyHigh + sellHigh],
        buyCount: r?.buyCount ?? 0,
        sellCount: r?.sellCount ?? 0,
      });
    }
    return out;
  }, [sector]);

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-2 -mt-1 flex-wrap">
        <span className="text-[11px] tracking-[0.15em] uppercase text-muted">View:</span>
        <div className="inline-flex overflow-hidden border border-ink">
          <button
            onClick={() => setMode("bs")}
            className={
              "px-2.5 sm:px-3 py-1 text-[11px] tracking-[0.12em] uppercase " +
              (mode === "bs"
                ? "bg-ink text-bg"
                : "bg-bg text-ink hover:bg-panel2")
            }
          >
            Buy / Sell
          </button>
          <button
            onClick={() => setMode("net")}
            className={
              "px-2.5 sm:px-3 py-1 text-[11px] tracking-[0.12em] uppercase border-l border-ink " +
              (mode === "net"
                ? "bg-ink text-bg"
                : "bg-bg text-ink hover:bg-panel2")
            }
          >
            Net
          </button>
        </div>
      </div>

      <div className="w-full h-[260px] sm:h-[320px]">
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 8, bottom: 4, left: 0 }}
            onClick={(e: { activeLabel?: string; activePayload?: Array<{ payload: Row }> }) => {
              const date = e?.activeLabel;
              const row = e?.activePayload?.[0]?.payload;
              if (date && row && (row.buyCount + row.sellCount) > 0) {
                navigate(`/day/${date}`);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#6b6b62"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={56}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              stroke="#6b6b62"
              tick={{ fontSize: 11 }}
              width={64}
              tickFormatter={(v) => {
                const n = Number(v);
                return (n < 0 ? "−" : "") + fmt$(Math.abs(n));
              }}
              allowDataOverflow={false}
            />
            <ReferenceLine y={0} stroke="#a88a4d" strokeOpacity={0.35} />

            {mode === "bs" ? (
              <>
                <Area type="monotone" dataKey="buyRange"  stroke="none" fill="rgba(62,122,62,0.18)"  isAnimationActive animationDuration={1400} animationEasing="ease-out" activeDot={false} legendType="none" name="buyRange" />
                <Area type="monotone" dataKey="sellRange" stroke="none" fill="rgba(165,42,42,0.18)"  isAnimationActive animationDuration={1400} animationEasing="ease-out" activeDot={false} legendType="none" name="sellRange" />
                <Line type="monotone" dataKey="buy"  name="Purchases" stroke="#3e7a3e" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={1400} animationEasing="ease-out" />
                <Line type="monotone" dataKey="sell" name="Sales"     stroke="#a52a2a" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={1400} animationEasing="ease-out" animationBegin={120} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="netRange" stroke="none" fill="rgba(209,179,113,0.22)" isAnimationActive animationDuration={1400} animationEasing="ease-out" activeDot={false} legendType="none" name="netRange" />
                <Line type="monotone" dataKey="net"  name="Net" stroke="#a88a4d" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={1400} animationEasing="ease-out" />
              </>
            )}

            <Legend
              verticalAlign="bottom"
              content={() => (
                <div style={{
                  display: "flex", gap: 20, justifyContent: "center",
                  fontSize: 11, color: "#6b6b62", paddingTop: 8,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                }}>
                  {mode === "bs" ? (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 16, height: 2, background: "#3e7a3e", display: "inline-block" }} />
                        Purchases
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 16, height: 2, background: "#a52a2a", display: "inline-block" }} />
                        Sales
                      </span>
                    </>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 16, height: 2, background: "#a88a4d", display: "inline-block" }} />
                      Net (Purchases − Sales)
                    </span>
                  )}
                </div>
              )}
            />
            <Tooltip
              cursor={{ stroke: "rgba(0,0,0,0.2)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const row = payload[0].payload as Row;
                const txTotal = row.buyCount + row.sellCount;
                return (
                  <div style={{
                    background: "#ffffff", border: "1px solid #d6c89c",
                    padding: "10px 12px", fontSize: 12, color: "#2c2519",
                    minWidth: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}>
                    <div style={{ color: "#2c2519", marginBottom: 4, fontWeight: 600 }}>
                      {label}{" "}
                      <span style={{ color: "#6b6b62", fontWeight: 400 }}>
                        · {txTotal} tx ({row.buyCount}B / {row.sellCount}S)
                      </span>
                    </div>
                    {mode === "bs" ? (
                      <>
                        {row.buy > 0 ? (
                          <div style={{ color: "#3e7a3e" }}>
                            Buy: {fmt$(row.buy)}{" "}
                            <span style={{ color: "#6b6b62" }}>
                              ({fmt$(row.buyRange[0])} – {fmt$(row.buyRange[1])}, {row.buyCount} tx)
                            </span>
                          </div>
                        ) : null}
                        {row.sell < 0 ? (
                          <div style={{ color: "#a52a2a" }}>
                            Sell: {fmt$(Math.abs(row.sell))}{" "}
                            <span style={{ color: "#6b6b62" }}>
                              ({fmt$(Math.abs(row.sellRange[1]))} – {fmt$(Math.abs(row.sellRange[0]))}, {row.sellCount} tx)
                            </span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      txTotal > 0 ? (
                        <div style={{ color: row.net >= 0 ? "#2e7d32" : "#b71c1c" }}>
                          Net: {row.net >= 0 ? "+" : "−"}{fmt$(Math.abs(row.net))}{" "}
                          <span style={{ color: "#6b6b62" }}>
                            (range {fmt$(row.netRange[0])} – {fmt$(row.netRange[1])})
                          </span>
                        </div>
                      ) : null
                    )}
                    {txTotal === 0 ? (
                      <div style={{ color: "#6b6b62" }}>No activity</div>
                    ) : null}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
