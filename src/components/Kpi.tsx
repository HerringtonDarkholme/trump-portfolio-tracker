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
  subInline = false,
  color,
  variant = "lg",
  info,
  children,
}: {
  label: string;
  sub?: string;
  // When true, render `sub` on the same baseline as the main value rather
  // than below it (smaller, muted).
  subInline?: boolean;
  color?: Color;
  variant?: Variant;
  info?: React.ReactNode;
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
    <div className={`bg-panel border border-border ${padding} relative min-w-0 hover:z-30 focus-within:z-30`}>
      <div className={`absolute top-0 left-0 ${stripeW} h-0.5 bg-accent`} />
      {info && (
        <span
          className="absolute top-1.5 right-1.5 z-10 group inline-flex items-center"
          tabIndex={0}
        >
          <span
            aria-label="How this is calculated"
            className="w-4 h-4 rounded-full border border-border bg-bg text-muted group-hover:text-ink group-hover:border-ink group-focus-within:text-ink group-focus-within:border-ink flex items-center justify-center text-[9px] font-serif italic cursor-help"
          >
            i
          </span>
          <span
            role="tooltip"
            className="hidden group-hover:block group-focus-within:block absolute top-full right-0 mt-1 w-64 bg-panel border border-ink shadow-lg p-3 text-[11px] leading-relaxed text-ink whitespace-normal normal-case tracking-normal z-30 pointer-events-none"
          >
            {info}
          </span>
        </span>
      )}
      <div className={`text-[11px] font-medium uppercase tracking-[0.16em] sm:tracking-[0.18em] text-muted truncate ${info ? "pr-5" : ""}`}>
        {label}
      </div>
      <div
        className={
          `mt-1.5 sm:mt-2 ${valueText} font-serif leading-tight tabular-nums ${color$} ` +
          (subInline && sub
            ? "flex items-baseline gap-2 flex-wrap min-w-0"
            : "break-all")
        }
      >
        <span className={subInline ? "min-w-0 break-all" : ""}>{children}</span>
        {subInline && sub && (
          <span className="font-sans font-normal normal-case tracking-normal text-xs sm:text-sm text-muted">
            {sub}
          </span>
        )}
      </div>
      {!subInline && sub && (
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
  info,
}: {
  label: string;
  value: number;
  sub?: string;
  variant?: Variant;
  info?: React.ReactNode;
}) {
  const v = useRollIn(value);
  return (
    <Card label={label} sub={sub} variant={variant} info={info}>
      <NumberFlow value={v} transformTiming={TIMING} spinTiming={TIMING} />
    </Card>
  );
}

export function KpiPct({
  label,
  value,
  sub,
  subInline,
  color,
  signed = false,
  variant,
  info,
}: {
  label: string;
  value: number; // percentage points (e.g. pass 12.3 for "12.3%")
  sub?: string;
  subInline?: boolean;
  color?: Color;
  signed?: boolean;
  variant?: Variant;
  info?: React.ReactNode;
}) {
  const v = useRollIn(value);
  return (
    <Card label={label} sub={sub} subInline={subInline} color={color} variant={variant} info={info}>
      <NumberFlow
        value={v}
        suffix="%"
        format={{
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
          signDisplay: signed ? "exceptZero" : "auto",
        }}
        transformTiming={TIMING}
        spinTiming={TIMING}
      />
    </Card>
  );
}

export function KpiNum({
  label,
  value,
  sub,
  variant,
  frac = 2,
  info,
}: {
  label: string;
  value: number;
  sub?: string;
  variant?: Variant;
  frac?: number;
  info?: React.ReactNode;
}) {
  const v = useRollIn(value);
  return (
    <Card label={label} sub={sub} variant={variant} info={info}>
      <NumberFlow
        value={v}
        format={{
          minimumFractionDigits: frac,
          maximumFractionDigits: frac,
        }}
        transformTiming={TIMING}
        spinTiming={TIMING}
      />
    </Card>
  );
}

export function KpiDollar({
  label,
  value,
  sub,
  subInline,
  color,
  signed = false,
  variant,
  info,
}: {
  label: string;
  value: number;
  sub?: string;
  subInline?: boolean;
  color?: Color;
  signed?: boolean;
  variant?: Variant;
  info?: React.ReactNode;
}) {
  const parts = split$(value, signed);
  const v = useRollIn(parts.value);
  return (
    <Card label={label} sub={sub} subInline={subInline} color={color} variant={variant} info={info}>
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
