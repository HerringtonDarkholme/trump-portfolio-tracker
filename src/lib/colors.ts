// Diverging green ↔ neutral ↔ red scale for net-flow on a light/cream background.

const BUY = { r: 58, g: 122, b: 58 };     // forest green
const SELL = { r: 165, g: 42, b: 42 };    // brick red
const NEUTRAL = { r: 235, g: 225, b: 196 }; // sand neutral over panel #fdfaf0

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
  const intensity = Math.pow(Math.abs(ratio), dampen);
  const target = ratio >= 0 ? BUY : SELL;
  return toHex(mix(NEUTRAL, target, intensity));
}

export function netFlowTextColor(net: number, totalVolume: number): string {
  // White text on saturated colors, ink-black on cream/light cells.
  if (totalVolume === 0) return "#1a1a1a";
  const ratio = Math.abs(net / totalVolume);
  return ratio > 0.35 ? "#ffffff" : "#1a1a1a";
}
