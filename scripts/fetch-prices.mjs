// Fetches daily OHLC from Yahoo Finance for every resolved ticker in our
// dataset and writes per-ticker JSON to public/prices/. The browser can't hit
// query1.finance.yahoo.com directly (no CORS), so we pre-fetch in Node and
// ship the data as static files.
//
// Run: `node scripts/fetch-prices.mjs`
//
// Window: 60 days before the earliest transaction → today.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const dataset = JSON.parse(
  await fs.readFile(path.join(ROOT, "src/data/dataset.json"), "utf-8")
);

const outDir = path.join(ROOT, "public/prices");
await fs.mkdir(outDir, { recursive: true });

// Earliest tx → today (+ buffer).
const allDates = [];
for (const s of Object.values(dataset.stocks)) {
  for (const t of s.transactions) allDates.push(t.date);
}
allDates.sort();
const earliest = new Date(allDates[0] + "T00:00:00Z").getTime();
const period1 = Math.floor((earliest - 60 * 86400_000) / 1000);
const period2 = Math.floor(Date.now() / 1000);

const tickers = Object.keys(dataset.stocks).filter(
  (t) => !t.startsWith("UNKN-")
);
console.log(
  `Fetching prices for ${tickers.length} tickers, ` +
  `window ${new Date(period1 * 1000).toISOString().slice(0, 10)} → ${new Date(period2 * 1000).toISOString().slice(0, 10)}…`
);

async function fetchOne(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d`;
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    },
  });
}

async function fetchTicker(ticker) {
  // Yahoo uses "-" where some feeds use "." (e.g. BRK.B → BRK-B). Try the
  // dot form first since that's what our seed uses, fall back to dash.
  let res = await fetchOne(ticker);
  if (!res.ok && ticker.includes(".")) {
    res = await fetchOne(ticker.replace(/\./g, "-"));
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const err = json?.chart?.error;
  if (err) throw new Error(err.description || err.code || "yahoo error");
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q) return null;
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open[i] == null || q.close[i] == null) continue;
    const d = new Date(ts[i] * 1000);
    candles.push({
      time: d.toISOString().slice(0, 10),
      open: +q.open[i].toFixed(4),
      high: +q.high[i].toFixed(4),
      low: +q.low[i].toFixed(4),
      close: +q.close[i].toFixed(4),
    });
  }
  return candles;
}

// Concurrency: 6 in flight is polite and ~4× faster than serial.
const CONCURRENCY = 6;
let succeeded = 0;
let failed = 0;
const failures = [];

async function worker(slice) {
  for (const ticker of slice) {
    try {
      const candles = await fetchTicker(ticker);
      if (!candles || candles.length === 0) {
        failures.push([ticker, "empty"]);
        failed++;
        continue;
      }
      await fs.writeFile(
        path.join(outDir, `${ticker}.json`),
        JSON.stringify({ candles })
      );
      succeeded++;
      if (succeeded % 25 === 0) {
        console.log(`  ${succeeded}/${tickers.length}…`);
      }
    } catch (e) {
      failures.push([ticker, String(e.message || e)]);
      failed++;
    }
  }
}

// Round-robin distribute
const slices = Array.from({ length: CONCURRENCY }, (_, i) =>
  tickers.filter((_, idx) => idx % CONCURRENCY === i)
);
await Promise.all(slices.map(worker));

console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
if (failures.length > 0) {
  console.log("Failures:");
  for (const [t, e] of failures) console.log(`  ${t}: ${e}`);
}
