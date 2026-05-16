// Fetches a company logo for every resolved ticker.
//
// Strategy: try eodhd's PNG CDN first (broader coverage of US tickers
// including dotted symbols like BRK.B), fall back to Parqet's SVG CDN
// (which has some names eodhd misses, e.g. AAPL).
//
// Saves to public/logos/{TICKER}.{png|svg}. The frontend tries .png first
// then .svg via onError.
//
// Run: `node scripts/fetch-logos.mjs`

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const dataset = JSON.parse(
  await fs.readFile(path.join(ROOT, "src/data/dataset.json"), "utf-8")
);

const outDir = path.join(ROOT, "public/logos");
await fs.mkdir(outDir, { recursive: true });

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
};

async function tryFetch(url) {
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null; // empty placeholder
    return buf;
  } catch {
    return null;
  }
}

function detectExt(buf) {
  // PNG magic bytes
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // SVG: starts with '<' or '<?xml'
  if (buf[0] === 0x3c) return "svg";
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return null;
}

async function fetchLogo(ticker) {
  // Try eodhd PNG first
  const eodhd = await tryFetch(`https://eodhd.com/img/logos/US/${encodeURIComponent(ticker)}.png`);
  if (eodhd && detectExt(eodhd) === "png") {
    return { buf: eodhd, ext: "png" };
  }
  // Fall back to Parqet (SVG or PNG)
  const parqet = await tryFetch(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}`);
  if (parqet) {
    const ext = detectExt(parqet);
    if (ext) return { buf: parqet, ext };
  }
  // Final try: Parqet with explicit PNG format
  const parqetPng = await tryFetch(`https://assets.parqet.com/logos/symbol/${encodeURIComponent(ticker)}?format=png`);
  if (parqetPng) {
    const ext = detectExt(parqetPng);
    if (ext) return { buf: parqetPng, ext };
  }
  return null;
}

const tickers = Object.keys(dataset.stocks).filter((t) => !t.startsWith("UNKN-"));
console.log(`Fetching logos for ${tickers.length} tickers…`);

let succeeded = 0;
let failed = 0;
const failures = [];
const CONCURRENCY = 8;
const slices = Array.from({ length: CONCURRENCY }, (_, i) =>
  tickers.filter((_, idx) => idx % CONCURRENCY === i)
);

async function worker(slice) {
  for (const ticker of slice) {
    try {
      const got = await fetchLogo(ticker);
      if (!got) {
        failures.push(ticker);
        failed++;
        continue;
      }
      // Wipe any existing variant for this ticker so we don't end up with
      // stale alt-extension files lying around.
      for (const ext of ["png", "svg", "jpg"]) {
        try {
          await fs.unlink(path.join(outDir, `${ticker}.${ext}`));
        } catch {
          /* not there, fine */
        }
      }
      await fs.writeFile(path.join(outDir, `${ticker}.${got.ext}`), got.buf);
      succeeded++;
      if (succeeded % 50 === 0) {
        console.log(`  ${succeeded}/${tickers.length}…`);
      }
    } catch (e) {
      failures.push(ticker);
      failed++;
    }
  }
}

await Promise.all(slices.map(worker));

console.log(`\nDone. ${succeeded} logos saved, ${failed} not found.`);
if (failures.length > 0 && failures.length < 40) {
  console.log("Missing:", failures.join(", "));
}
