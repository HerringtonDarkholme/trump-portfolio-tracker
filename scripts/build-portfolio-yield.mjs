// Pre-compute portfolio-wide estimated yield for each supported snapshot
// date. Reads dataset.json + public/prices/*.json, applies the same
// per-transaction linear yield logic as src/routes/Stock.tsx, aggregates
// across all stocks, and writes src/data/portfolio-yield.json.
//
// Run AFTER `fetch:prices` so the per-ticker price files exist.
//
//   node scripts/build-portfolio-yield.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PRICES_DIR = path.join(ROOT, "public/prices");
const OUT_FILE = path.join(ROOT, "src/data/portfolio-yield.json");

// Keep in sync with SNAPSHOT_OPTIONS in src/routes/Stock.tsx.
const SNAPSHOT_DATES = ["2026-05-14", "2026-03-31"];

const dataset = JSON.parse(
  await fs.readFile(path.join(ROOT, "src/data/dataset.json"), "utf-8")
);

function eligible(s) {
  return (
    !s.ticker.startsWith("UNKN-") &&
    s.sector !== "Money Market" &&
    !/\.[A-Z]+$/.test(s.ticker)
  );
}

async function loadPrices(ticker) {
  try {
    const raw = await fs.readFile(path.join(PRICES_DIR, `${ticker}.json`), "utf-8");
    const json = JSON.parse(raw);
    const m = new Map();
    for (const c of json.candles ?? []) m.set(c.time, c);
    return m;
  } catch {
    return null;
  }
}

function resolveSnapshot(priceMap, target) {
  if (priceMap.has(target) && priceMap.get(target).close) {
    return { date: target, close: priceMap.get(target).close };
  }
  // Walk back to nearest prior trading day in the map.
  let best = "";
  let bestClose = 0;
  for (const [d, c] of priceMap.entries()) {
    if (d <= target && d > best && c.close) {
      best = d;
      bestClose = c.close;
    }
  }
  if (!bestClose) return null;
  return { date: best, close: bestClose };
}

function computeStockYield(stock, priceMap, target) {
  const snap = resolveSnapshot(priceMap, target);
  if (!snap) return null;
  let estCost = 0,
    estProceeds = 0,
    estSharesHeld = 0,
    estPnL = 0,
    maxPnL = 0,
    minPnL = 0,
    counted = 0,
    skipped = 0,
    excludedFuture = 0;
  for (const t of stock.transactions) {
    if (t.date > snap.date) {
      excludedFuture++;
      continue;
    }
    const c = priceMap.get(t.date);
    if (!c?.close) {
      skipped++;
      continue;
    }
    const p = c.close;
    if (t.type === "purchase") {
      estCost += t.mid;
      estSharesHeld += t.mid / p;
      const coef = snap.close / p - 1;
      estPnL += t.mid * coef;
      if (coef >= 0) {
        maxPnL += t.high * coef;
        minPnL += t.low * coef;
      } else {
        maxPnL += t.low * coef;
        minPnL += t.high * coef;
      }
    } else {
      estProceeds += t.mid;
      estSharesHeld -= t.mid / p;
      const coef = 1 - snap.close / p;
      estPnL += t.mid * coef;
      if (coef >= 0) {
        maxPnL += t.high * coef;
        minPnL += t.low * coef;
      } else {
        maxPnL += t.low * coef;
        minPnL += t.high * coef;
      }
    }
    counted++;
  }
  if (counted === 0) return null;
  return {
    snapshotDate: snap.date,
    snapshotClose: snap.close,
    estCost,
    estProceeds,
    estSharesHeld,
    estHoldingValue: estSharesHeld * snap.close,
    estPnL,
    maxPnL,
    minPnL,
    counted,
    skipped,
    excludedFuture,
  };
}

const allStocks = Object.values(dataset.stocks);
const eligibleStocks = allStocks.filter(eligible);

const out = { generatedAt: new Date().toISOString(), snapshots: [] };

for (const target of SNAPSHOT_DATES) {
  let estCost = 0,
    estProceeds = 0,
    estHoldingValue = 0,
    estPnL = 0,
    maxPnL = 0,
    minPnL = 0,
    txCounted = 0,
    txSkipped = 0,
    txExcludedFuture = 0,
    tickersCounted = 0,
    tickersSkipped = 0;

  // Per-ticker P&L — keyed by ticker symbol. Used by leaderboard's best/worst
  // P&L tabs. Rounded to whole dollars so the JSON stays compact.
  const stocks = {};

  for (const s of allStocks) {
    if (!eligible(s)) {
      tickersSkipped++;
      continue;
    }
    const map = await loadPrices(s.ticker);
    if (!map || map.size === 0) {
      tickersSkipped++;
      continue;
    }
    const r = computeStockYield(s, map, target);
    if (!r) {
      tickersSkipped++;
      continue;
    }
    tickersCounted++;
    estCost += r.estCost;
    estProceeds += r.estProceeds;
    estHoldingValue += r.estHoldingValue;
    estPnL += r.estPnL;
    maxPnL += r.maxPnL;
    minPnL += r.minPnL;
    txCounted += r.counted;
    txSkipped += r.skipped;
    txExcludedFuture += r.excludedFuture;
    stocks[s.ticker] = {
      estPnL: Math.round(r.estPnL),
      estHoldingValue: Math.round(r.estHoldingValue),
      counted: r.counted,
    };
  }

  const denomBase = Math.max(estCost, estProceeds);
  const denom = denomBase > 0 ? denomBase : 1;

  out.snapshots.push({
    date: target,
    estCost,
    estProceeds,
    estHoldingValue,
    estPnL,
    maxPnL,
    minPnL,
    denomBase,
    estYieldPct: (estPnL / denom) * 100,
    maxYieldPct: (maxPnL / denom) * 100,
    minYieldPct: (minPnL / denom) * 100,
    tickersCounted,
    tickersSkipped,
    txCounted,
    txSkipped,
    txExcludedFuture,
    stocks,
  });

  console.log(
    `[${target}] tickers ${tickersCounted}/${eligibleStocks.length} eligible, ` +
      `P&L $${Math.round(estPnL).toLocaleString()}, yield ${(
        (estPnL / denom) *
        100
      ).toFixed(2)}%`
  );
}

await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
