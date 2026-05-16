export function fmt$(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a).toLocaleString()}`;
}

export function fmtSigned$(n: number): string {
  if (n > 0) return "+" + fmt$(n);
  return fmt$(n);
}

export function fmtInt(n: number): string {
  return n.toLocaleString();
}

/**
 * Splits a dollar amount into a numeric body and a magnitude suffix so the
 * numeric portion can be animated with @number-flow/react while the suffix
 * (M/B/K) stays static. Sign is preserved on the value when `signed` is true,
 * so NumberFlow can use `signDisplay: "exceptZero"` for sliding +/-.
 */
export function split$(n: number, signed = false): {
  value: number;
  suffix: "B" | "M" | "K" | "";
  minFrac: number;
  maxFrac: number;
  signed: boolean;
} {
  if (!isFinite(n)) return { value: 0, suffix: "", minFrac: 0, maxFrac: 0, signed };
  const a = Math.abs(n);
  const sign = n < 0 ? -1 : 1;
  if (a >= 1e9) return { value: (a / 1e9) * sign, suffix: "B", minFrac: 2, maxFrac: 2, signed };
  if (a >= 1e6) return { value: (a / 1e6) * sign, suffix: "M", minFrac: 2, maxFrac: 2, signed };
  if (a >= 1e3) return { value: (a / 1e3) * sign, suffix: "K", minFrac: 1, maxFrac: 1, signed };
  return { value: Math.round(a) * sign, suffix: "", minFrac: 0, maxFrac: 0, signed };
}
