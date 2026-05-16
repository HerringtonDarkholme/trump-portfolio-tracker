import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ErrorBar,
} from "recharts";
import type { Transaction } from "../types";
import { fmt$ } from "../lib/format";

type Row = {
  date: string;
  buy: number;        // plotted value (>= 0)
  buyLow: number;     // sum of bucket lows (>= 0)
  buyHigh: number;    // sum of bucket highs (>= 0)
  buyErr: [number, number] | null;
  sell: number;       // plotted value (<= 0)
  sellLow: number;    // sum of bucket lows, in plot coords (<= 0)
  sellHigh: number;   // sum of bucket highs, in plot coords (<= 0)
  sellErr: [number, number] | null;
};

export default function StockMonthlyChart({ transactions }: { transactions: Transaction[] }) {
  const data = useMemo<Row[]>(() => {
    const byDay: Record<string, Row> = {};
    for (const t of transactions) {
      const r = (byDay[t.date] ??= {
        date: t.date,
        buy: 0, buyLow: 0, buyHigh: 0, buyErr: null,
        sell: 0, sellLow: 0, sellHigh: 0, sellErr: null,
      });
      if (t.type === "purchase") {
        r.buy += t.mid;
        r.buyLow += t.low;
        r.buyHigh += t.high;
      } else {
        r.sell -= t.mid;
        r.sellLow -= t.high; // most-negative plot value = upper bound of sold $
        r.sellHigh -= t.low; // least-negative plot value = lower bound of sold $
      }
    }
    // Compute asymmetric ErrorBar offsets: [downwardOffset, upwardOffset], both positive.
    for (const r of Object.values(byDay)) {
      if (r.buy > 0) {
        r.buyErr = [Math.max(0, r.buy - r.buyLow), Math.max(0, r.buyHigh - r.buy)];
      }
      if (r.sell < 0) {
        r.sellErr = [Math.max(0, r.sell - r.sellLow), Math.max(0, r.sellHigh - r.sell)];
      }
    }
    return Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions]);

  const yDomain = useMemo<[number, number]>(() => {
    let max = 0, min = 0;
    for (const r of data) {
      if (r.buyHigh > max) max = r.buyHigh;
      if (r.sellLow < min) min = r.sellLow;
    }
    const pad = Math.max(max, -min) * 0.08 || 1;
    return [min - pad, max + pad];
  }, [data]);

  return (
    <div className="w-full h-[240px] sm:h-[280px]">
      <ResponsiveContainer>
        <BarChart data={data} stackOffset="sign" margin={{ top: 10, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#6b6b62"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={36}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            stroke="#6b6b62"
            tick={{ fontSize: 10 }}
            width={64}
            tickFormatter={(v) => {
              const n = Number(v);
              return (n < 0 ? "−" : "") + fmt$(Math.abs(n));
            }}
            domain={yDomain}
            allowDataOverflow={false}
          />
          <ReferenceLine y={0} stroke="#a88a4d" strokeOpacity={0.35} />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const row = payload[0].payload as Row;
              return (
                <div style={{
                  background: "#ffffff", border: "1px solid #d6c89c",
                  padding: "10px 12px", fontSize: 12, color: "#2c2519",
                  minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}>
                  <div style={{ color: "#2c2519", marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  {row.buy > 0 && (
                    <div style={{ color: "#3e7a3e" }}>
                      Buy: {fmt$(row.buy)}{" "}
                      <span style={{ color: "#6b6b62" }}>
                        ({fmt$(row.buyLow)} – {fmt$(row.buyHigh)})
                      </span>
                    </div>
                  )}
                  {row.sell < 0 && (
                    <div style={{ color: "#a52a2a" }}>
                      Sell: {fmt$(Math.abs(row.sell))}{" "}
                      <span style={{ color: "#6b6b62" }}>
                        ({fmt$(Math.abs(row.sellHigh))} – {fmt$(Math.abs(row.sellLow))})
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="buy" stackId="x" fill="rgba(62,122,62,0.85)" name="Purchases" isAnimationActive={false}>
            <ErrorBar dataKey="buyErr" width={6} strokeWidth={1.5} stroke="#1b4d1e" direction="y" />
          </Bar>
          <Bar dataKey="sell" stackId="x" fill="rgba(165,42,42,0.85)" name="Sales" isAnimationActive={false}>
            <ErrorBar dataKey="sellErr" width={6} strokeWidth={1.5} stroke="#7a0e0e" direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
