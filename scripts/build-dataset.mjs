import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import Fuse from "fuse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "trump_278T.csv");
const SEED_PATH = path.join(ROOT, "data", "ticker-seed.json");
const OUT_DIR = path.join(ROOT, "src", "data");
const OUT_PATH = path.join(OUT_DIR, "dataset.json");

const BUCKETS = {
  "$1,001 - $15,000": [1001, 15000],
  "$15,001 - $50,000": [15001, 50000],
  "$50,001 - $100,000": [50001, 100000],
  "$100,001 - $250,000": [100001, 250000],
  "$250,001 - $500,000": [250001, 500000],
  "$500,001 - $1,000,000": [500001, 1000000],
  "$1,000,001 - $5,000,000": [1000001, 5000000],
  "$5,000,001 - $25,000,000": [5000001, 25000000],
};
const midpoint = (range) => {
  const b = BUCKETS[range];
  return b ? (b[0] + b[1]) / 2 : 0;
};
const bounds = (range) => {
  const b = BUCKETS[range];
  return b ? { low: b[0], high: b[1] } : { low: 0, high: 0 };
};

function normalize(raw) {
  let s = (raw || "").toUpperCase();
  s = s.replace(/SOLICITED ORDER DISCRETION EXERCISED/g, " ");
  s = s.replace(/AVERAGE UNIT PRICE TRANSACTION/g, " ");
  s = s.replace(/YOUR BROKER ACTED AS AGENT/g, " ");
  s = s.replace(/ALLOCATED ORDER/g, " ");
  s = s.replace(/FORWARD SPLIT WITH STOCK SPLIT SHARES/g, " ");
  s = s.replace(/MERGER ELECTION EXP:\s*\d{2}\/\d{2}\/\d{2}/g, " ");
  s = s.replace(/\bWITH DUE BILLS\b/g, " ");
  s = s.replace(/\bPAIRED CTF[^,]*$/g, " ");
  s = s.replace(/\([^)]*\)/g, " ");  // strip parenthetical "(DELAWARE)" / "(HOLDING CO)"
  s = s.replace(/\bEQUITY CLASS\s*$/g, " ");
  s = s.replace(/\bUNSOLICITED\b/g, " ");
  s = s.replace(/\bUSD\d*\.\d+\b/g, " ");  // share denomination like USD0.0001
  s = s.replace(/\bUSD\b/g, " ");
  // Trailing partial phrases from truncated descriptions.
  s = s.replace(/\bYOUR BROKER\s*$/g, " ");
  s = s.replace(/\b[A-Z]?\d{6,}[\d-]*\b/g, " ");
  s = s.replace(/\bPROCTOR\b/g, "PROCTER");
  s = s.replace(/\bWATCH GROUP\b/g, "MATCH GROUP");
  s = s.replace(/\bNFL BUSINESS MACH\b/g, "INTL BUSINESS MACH");
  s = s.replace(/\bMOSLIS\b/g, "MOELIS");
  s = s.replace(/\bMOBLIS\b/g, "MOELIS");
  // "NETFLIX COM INC" / "AMAZON COM INC" — strip internal COM so seed aliases hit.
  s = s.replace(/\bCOM\s+INC\b/g, "INC");
  // Collapse whitespace BEFORE trailing-suffix strip so the $ anchor works.
  s = s.replace(/\s+/g, " ").trim().replace(/[,.\s]+$/, "").trim();
  for (let i = 0; i < 7; i++) {
    s = s.replace(/[\s,.]+(COM|CL\s+[ABC]|CLASS\s+[ABC]|SHS|REIT|NEW|INC NEW|DEL|F|CAP STK|EQUITY|EUR|ORD|ORD SHS|N V|NV|HLDGS|HOLDINGS)$/, "");
  }
  s = s.replace(/\s+/g, " ").trim().replace(/[,.\s]+$/, "").trim();
  return s;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function parseDate(s) {
  const [m, d, y] = s.split("/").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(+dt) || dt.getUTCMonth() !== m - 1 ? null : dt;
}

// --- Load seed --------------------------------------------------------------
const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));

// Build alias → ticker exact map, and the list for fuzzy matching.
const aliasToTicker = new Map();
const aliasList = [];
for (const [ticker, info] of Object.entries(seed)) {
  for (const a of info.aliases) {
    const key = a.toUpperCase().trim();
    aliasToTicker.set(key, ticker);
    aliasList.push({ alias: key, ticker });
  }
}
const fuse = new Fuse(aliasList, { keys: ["alias"], threshold: 0.3, includeScore: true });

// --- Parse CSV --------------------------------------------------------------
const csvText = fs.readFileSync(CSV_PATH, "utf8");
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
if (parsed.errors.length) {
  console.warn("CSV parse warnings:", parsed.errors.slice(0, 3));
}

// --- Resolve each row -------------------------------------------------------
const stocks = {};
const fuzzyAuditLog = [];
const unresolvedSet = new Set();

for (const row of parsed.data) {
  const desc = row.Description?.trim();
  if (!desc || !row.Type || !row.Amount) continue;
  const date = parseDate(row.Date);
  if (!date) continue;

  const canonical = normalize(desc);
  let ticker = aliasToTicker.get(canonical);
  let resolutionKind = "exact";

  if (!ticker) {
    const hit = fuse.search(canonical)[0];
    if (hit && hit.score !== undefined && hit.score < 0.25) {
      ticker = hit.item.ticker;
      resolutionKind = "fuzzy";
      fuzzyAuditLog.push({ canonical, matchedAlias: hit.item.alias, ticker, score: hit.score });
    }
  }

  let info;
  if (ticker) {
    info = seed[ticker];
  } else {
    ticker = "UNKN-" + slugify(canonical);
    info = { name: canonical, sector: "Unknown" };
    unresolvedSet.add(canonical);
  }

  if (!stocks[ticker]) {
    stocks[ticker] = {
      ticker,
      name: info.name,
      sector: info.sector,
      totalBuy: 0,
      totalSell: 0,
      net: 0,
      txCount: 0,
      firstDate: row.Date,
      lastDate: row.Date,
      transactions: [],
      resolution: resolutionKind,
    };
  }

  const mid = midpoint(row.Amount);
  const type = row.Type.toLowerCase();
  const s = stocks[ticker];
  if (type === "purchase") s.totalBuy += mid;
  else if (type === "sale") s.totalSell += mid;
  s.net = s.totalBuy - s.totalSell;
  s.txCount += 1;

  const isoDate = date.toISOString().slice(0, 10);
  if (isoDate < (s.firstDate || "9999")) s.firstDate = isoDate;
  if (isoDate > (s.lastDate || "")) s.lastDate = isoDate;

  const { low, high } = bounds(row.Amount);
  s.transactions.push({
    n: Number(row["#"]) || 0,
    date: isoDate,
    type,
    amount: row.Amount,
    mid,
    low,
    high,
    rawDescription: desc,
  });
}

// Sort each stock's tx by date desc
for (const s of Object.values(stocks)) {
  s.transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// --- Build sector aggregates ------------------------------------------------
const sectors = {};
for (const s of Object.values(stocks)) {
  const sec = s.sector || "Unknown";
  if (!sectors[sec]) sectors[sec] = { sector: sec, totalVolume: 0, netFlow: 0, tickers: [] };
  sectors[sec].totalVolume += s.totalBuy + s.totalSell;
  sectors[sec].netFlow += s.net;
  sectors[sec].tickers.push(s.ticker);
}

// --- Totals -----------------------------------------------------------------
let txCount = 0, buyCount = 0, sellCount = 0, totalVolume = 0, netFlow = 0;
for (const s of Object.values(stocks)) {
  txCount += s.txCount;
  totalVolume += s.totalBuy + s.totalSell;
  netFlow += s.net;
  for (const t of s.transactions) {
    if (t.type === "purchase") buyCount++;
    else if (t.type === "sale") sellCount++;
  }
}

const totals = {
  txCount,
  buyCount,
  sellCount,
  totalVolume,
  netFlow,
  uniqueTickers: Object.keys(stocks).length,
  unresolvedCount: unresolvedSet.size,
};

const out = {
  generatedAt: new Date().toISOString(),
  totals,
  stocks,
  sectors,
  unresolved: [...unresolvedSet].sort(),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out));

// --- Emit XML sitemap for search engines ---------------------------------
const SITE_URL = process.env.SITE_URL || "https://trump-portfolio.vercel.app";
const today = new Date().toISOString().slice(0, 10);
const uniqueDays = new Set();
for (const s of Object.values(stocks)) for (const t of s.transactions) uniqueDays.add(t.date);

const urls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/sitemap", priority: "0.3", changefreq: "monthly" },
  ...Object.keys(sectors).map((sec) => ({
    loc: `/sector/${encodeURIComponent(sec)}`, priority: "0.7", changefreq: "weekly",
  })),
  ...Object.keys(stocks).map((t) => ({
    loc: `/stock/${encodeURIComponent(t)}`, priority: "0.6", changefreq: "weekly",
  })),
  ...[...uniqueDays].sort().map((d) => ({
    loc: `/day/${d}`, priority: "0.4", changefreq: "monthly",
  })),
];

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(({ loc, priority, changefreq }) =>
    `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  ).join("\n") + "\n</urlset>\n";

const PUBLIC_DIR = path.join(ROOT, "public");
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), xml);
fs.writeFileSync(path.join(PUBLIC_DIR, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`  sitemap.xml:   ${urls.length} URLs → public/sitemap.xml`);
console.log(`  robots.txt:    public/robots.txt`);

// --- Report -----------------------------------------------------------------
const resolved = Object.values(stocks).filter((s) => !s.ticker.startsWith("UNKN-")).length;
console.log(`✓ Built ${OUT_PATH}`);
console.log(`  transactions: ${txCount} (${buyCount} buys, ${sellCount} sells)`);
console.log(`  total volume (midpoint): $${totalVolume.toLocaleString()}`);
console.log(`  net flow:                $${netFlow.toLocaleString()}`);
console.log(`  unique tickers: ${totals.uniqueTickers} (${resolved} resolved, ${unresolvedSet.size} UNKN-*)`);
console.log(`  fuzzy matches:  ${fuzzyAuditLog.length}`);
if (fuzzyAuditLog.length) {
  console.log("  sample fuzzy:");
  for (const f of fuzzyAuditLog.slice(0, 8)) {
    console.log(`    ${f.canonical}  →  ${f.ticker}  (matched "${f.matchedAlias}", score=${f.score.toFixed(2)})`);
  }
}
