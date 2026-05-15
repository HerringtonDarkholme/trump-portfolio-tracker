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
