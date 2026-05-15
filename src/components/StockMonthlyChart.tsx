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
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data} stackOffset="sign" margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#8b97ad"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            stroke="#8b97ad"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => fmt$(Math.abs(Number(v)))}
            domain={yDomain}
            allowDataOverflow={false}
          />
          <ReferenceLine y={0} stroke="#243047" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#1a2335",
              border: "1px solid #243047",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#cbd5e1" }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const row = payload[0].payload as Row;
              return (
                <div style={{
                  background: "#1a2335", border: "1px solid #243047",
                  borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#e6ecf5",
                  minWidth: 200,
                }}>
                  <div style={{ color: "#cbd5e1", marginBottom: 4 }}>{label}</div>
                  {row.buy > 0 && (
                    <div style={{ color: "#22c55e" }}>
                      Buy: {fmt$(row.buy)}{" "}
                      <span style={{ color: "#8b97ad" }}>
                        ({fmt$(row.buyLow)} – {fmt$(row.buyHigh)})
                      </span>
                    </div>
                  )}
                  {row.sell < 0 && (
                    <div style={{ color: "#ef4444" }}>
                      Sell: {fmt$(Math.abs(row.sell))}{" "}
                      <span style={{ color: "#8b97ad" }}>
                        ({fmt$(Math.abs(row.sellHigh))} – {fmt$(Math.abs(row.sellLow))})
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="buy" stackId="x" fill="rgba(34,197,94,0.85)" name="Purchases" isAnimationActive={false}>
            <ErrorBar dataKey="buyErr" width={6} strokeWidth={1.5} stroke="#86efac" direction="y" />
          </Bar>
          <Bar dataKey="sell" stackId="x" fill="rgba(239,68,68,0.85)" name="Sales" isAnimationActive={false}>
            <ErrorBar dataKey="sellErr" width={6} strokeWidth={1.5} stroke="#fca5a5" direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
