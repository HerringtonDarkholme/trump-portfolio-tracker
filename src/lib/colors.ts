// Diverging green ↔ gray ↔ red scale on net-flow ratio in [-1, 1].
// Intensity also scales with absolute net volume so tiny imbalances aren't saturated.

const BUY = { r: 34, g: 197, b: 94 };   // green-500
const SELL = { r: 239, g: 68, b: 68 };  // red-500
const NEUTRAL = { r: 50, g: 60, b: 78 };

function mix(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function netFlowColor(net: number, totalVolume: number, dampen = 0.5): string {
  if (totalVolume === 0) return toHex(NEUTRAL);
  const ratio = Math.max(-1, Math.min(1, net / totalVolume));
  // dampen pulls weak ratios toward neutral — `intensity` ∈ [0, 1]
  const intensity = Math.pow(Math.abs(ratio), dampen);
  const target = ratio >= 0 ? BUY : SELL;
  return toHex(mix(NEUTRAL, target, intensity));
}

export function netFlowTextColor(net: number, totalVolume: number): string {
  // White on saturated colors, lighter gray on neutral
  if (totalVolume === 0) return "#cbd5e1";
  const ratio = Math.abs(net / totalVolume);
  return ratio > 0.15 ? "#ffffff" : "#cbd5e1";
}
