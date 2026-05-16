import { useMemo, useState } from "react";
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
      <div className="flex items-center justify-end gap-2 mb-2 -mt-1">
        <span className="text-[11px] text-muted">View:</span>
        <div className="inline-flex rounded-md overflow-hidden border border-border">
          <button
            onClick={() => setMode("bs")}
            className={
              "px-2.5 py-1 text-xs " +
              (mode === "bs"
                ? "bg-accent/20 text-accent"
                : "bg-panel2 text-muted hover:text-white")
            }
          >
            Buy / Sell
          </button>
          <button
            onClick={() => setMode("net")}
            className={
              "px-2.5 py-1 text-xs border-l border-border " +
              (mode === "net"
                ? "bg-accent/20 text-accent"
                : "bg-panel2 text-muted hover:text-white")
            }
          >
            Net
          </button>
        </div>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#8b97ad"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={48}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              stroke="#8b97ad"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmt$(Math.abs(Number(v)))}
              allowDataOverflow={false}
            />
            <ReferenceLine y={0} stroke="#243047" />

            {mode === "bs" ? (
              <>
                <Area type="monotone" dataKey="buyRange"  stroke="none" fill="rgba(34,197,94,0.18)"  isAnimationActive={false} activeDot={false} legendType="none" name="buyRange" />
                <Area type="monotone" dataKey="sellRange" stroke="none" fill="rgba(239,68,68,0.18)"  isAnimationActive={false} activeDot={false} legendType="none" name="sellRange" />
                <Line type="monotone" dataKey="buy"  name="Purchases" stroke="#22c55e" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="sell" name="Sales"     stroke="#ef4444" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="netRange" stroke="none" fill="rgba(96,165,250,0.18)" isAnimationActive={false} activeDot={false} legendType="none" name="netRange" />
                <Line type="monotone" dataKey="net"  name="Net" stroke="#60a5fa" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </>
            )}

            <Legend
              verticalAlign="bottom"
              content={() => (
                <div style={{
                  display: "flex", gap: 16, justifyContent: "center",
                  fontSize: 12, color: "#cbd5e1", paddingTop: 8,
                }}>
                  {mode === "bs" ? (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 14, height: 2, background: "#22c55e", display: "inline-block" }} />
                        Purchases
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 14, height: 2, background: "#ef4444", display: "inline-block" }} />
                        Sales
                      </span>
                    </>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 14, height: 2, background: "#60a5fa", display: "inline-block" }} />
                      Net (purchases − sales)
                    </span>
                  )}
                </div>
              )}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const row = payload[0].payload as Row;
                const txTotal = row.buyCount + row.sellCount;
                return (
                  <div style={{
                    background: "#1a2335", border: "1px solid #243047",
                    borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#e6ecf5",
                    minWidth: 220,
                  }}>
                    <div style={{ color: "#cbd5e1", marginBottom: 4 }}>
                      {label} ·{" "}
                      <span style={{ color: "#8b97ad" }}>
                        {txTotal} tx ({row.buyCount}B / {row.sellCount}S)
                      </span>
                    </div>
                    {mode === "bs" ? (
                      <>
                        {row.buy > 0 ? (
                          <div style={{ color: "#22c55e" }}>
                            Buy: {fmt$(row.buy)}{" "}
                            <span style={{ color: "#8b97ad" }}>
                              ({fmt$(row.buyRange[0])} – {fmt$(row.buyRange[1])}, {row.buyCount} tx)
                            </span>
                          </div>
                        ) : null}
                        {row.sell < 0 ? (
                          <div style={{ color: "#ef4444" }}>
                            Sell: {fmt$(Math.abs(row.sell))}{" "}
                            <span style={{ color: "#8b97ad" }}>
                              ({fmt$(Math.abs(row.sellRange[1]))} – {fmt$(Math.abs(row.sellRange[0]))}, {row.sellCount} tx)
                            </span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      txTotal > 0 ? (
                        <div style={{ color: row.net >= 0 ? "#22c55e" : "#ef4444" }}>
                          Net: {row.net >= 0 ? "+" : "−"}{fmt$(Math.abs(row.net))}{" "}
                          <span style={{ color: "#8b97ad" }}>
                            (range {fmt$(row.netRange[0])} – {fmt$(row.netRange[1])})
                          </span>
                        </div>
                      ) : null
                    )}
                    {txTotal === 0 ? (
                      <div style={{ color: "#8b97ad" }}>No activity</div>
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
