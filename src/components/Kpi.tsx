import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { split$ } from "../lib/format";

const TIMING = { duration: 1400, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

function useRollIn<T extends number>(target: T): T {
  const [v, setV] = useState<T>(0 as T);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}

type Variant = "lg" | "md";
type Color = "buy" | "sell" | undefined;

function Card({
  label,
  sub,
  color,
  variant = "lg",
  children,
}: {
  label: string;
  sub?: string;
  color?: Color;
  variant?: Variant;
  children: React.ReactNode;
}) {
  const valueText =
    variant === "lg"
      ? "text-xl sm:text-3xl"
      : "text-lg sm:text-2xl";
  const stripeW = variant === "lg" ? "w-10 sm:w-12" : "w-8 sm:w-10";
  const padding = variant === "lg" ? "p-3 sm:p-5" : "p-3 sm:p-4";
  const color$ =
    color === "buy" ? "text-buy" : color === "sell" ? "text-sell" : "text-ink";
  return (
    <div className={`bg-panel border border-border ${padding} relative min-w-0`}>
      <div className={`absolute top-0 left-0 ${stripeW} h-0.5 bg-accent`} />
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] sm:tracking-[0.18em] text-muted truncate">
        {label}
      </div>
      <div className={`mt-1.5 sm:mt-2 ${valueText} font-serif break-all leading-tight tabular-nums ${color$}`}>
        {children}
      </div>
      {sub && (
        <div className="text-[11px] tracking-[0.1em] uppercase text-muted mt-1 sm:mt-1.5 truncate">
          {sub}
        </div>
      )}
    </div>
  );
}

export function KpiInt({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: number;
  sub?: string;
  variant?: Variant;
}) {
  const v = useRollIn(value);
  return (
    <Card label={label} sub={sub} variant={variant}>
      <NumberFlow value={v} transformTiming={TIMING} spinTiming={TIMING} />
    </Card>
  );
}

export function KpiDollar({
  label,
  value,
  sub,
  color,
  signed = false,
  variant,
}: {
  label: string;
  value: number;
  sub?: string;
  color?: Color;
  signed?: boolean;
  variant?: Variant;
}) {
  const parts = split$(value, signed);
  const v = useRollIn(parts.value);
  return (
    <Card label={label} sub={sub} color={color} variant={variant}>
      <NumberFlow
        value={v}
        prefix="$"
        suffix={parts.suffix}
        format={{
          minimumFractionDigits: parts.minFrac,
          maximumFractionDigits: parts.maxFrac,
          signDisplay: signed ? "exceptZero" : "auto",
        }}
        transformTiming={TIMING}
        spinTiming={TIMING}
      />
    </Card>
  );
}
