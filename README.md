# Trump Portfolio Dashboard

A static, pure-frontend visualization of Donald J. Trump's 2026 Periodic Transaction Reports filed with the U.S. Office of Government Ethics (OGE Form 278-T).

🔗 **Live site:** https://trump-portfolio.vercel.app/

3,642 disclosed transactions across 1,024 holdings, all resolved to canonical tickers and GICS-style sectors, rendered as an interactive sector heatmap, daily activity timeline, leaderboards, and per-stock / per-sector drill-downs.

## Features

- **Sector heatmap** — visx treemap, two-level (sector → stock). Cell size = total disclosed volume, color = net buy (green) ↔ net sell (red). Click a stock cell to drill into its history; click a sector header to drill into the sector. Min-volume slider with a power curve so the low end has fine granularity.
- **Daily activity chart** — recharts line chart aggregating every disclosed transaction by day. Toggle between Buy/Sell view (purchases above zero, sales below) and Net view (single line for purchases − sales). Shaded bands represent the disclosed dollar-range uncertainty per day.
- **Leaderboard** — sortable tables with 4 tabs: Biggest net buys, Biggest net sells, Highest volume, Most active. Sector filter applies to all tabs.
- **Per-stock page** (`/stock/:ticker`) — KPIs, daily bar chart with asymmetric error bars showing the disclosed bucket range, full sortable transaction table with the raw description so you can see what got normalized.
- **Per-sector page** (`/sector/:sector`) — sector-scoped daily activity chart, single-sector heatmap, full transaction table across the sector, KPI strip.
- **Global search** — header search box matches tickers, company names, and sectors. Keyboard navigable (`/` to focus, ↑↓ to move, Enter to open, Esc to close). Stocks ranked by volume so big names surface above tiny same-name matches.
- **100% ticker resolution** — every disclosed holding maps to a real ticker symbol and sector. No "Unknown" buckets.

## Tech stack

- Vite + React 18 + TypeScript
- react-router-dom v6 for routing
- @visx/treemap + @visx/hierarchy for the sector heatmap
- recharts for line/bar charts with error bars
- Tailwind CSS for styling
- PapaParse + Fuse.js used at *build time* in the dataset script (not bundled at runtime)

No backend. The browser loads a single pre-built `dataset.json` and renders everything client-side.

## How the data was collected

The single canonical source is the OGE PDF filing:

> **OGE Form 278-T**, filed 2026-05-08 by Donald J. Trump (filed late, OGE received 2026-05-12).
> https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/405E4EC4E27BE8D185258DF7002DD1C0/$FILE/Trump%2C%20Donald%20J.-05.08.2026-278T(2).pdf

The PDF was originally OCR'd into a `.csv` file with substantial OCR errors:

- 1,720 incorrect dates (47% of rows), including 57 transactions stamped with impossible future dates through Dec 2026
- 663 description corruptions (e.g., `ETHIOPIS INC` for SYNOPSYS, `RALLIANT CORP` for RELIANT, `DAVADOG` for DATADOG)
- 3 amount-bucket errors, including one row where description, date, and amount were all wrong simultaneously
- Row-order shuffling within price buckets vs. the PDF source

**The CSV was rebuilt from scratch by re-extracting every row from the source PDF via Anthropic vision** (the same way you'd read a paper form, just automated). The full pipeline:

1. **Eight parallel extraction agents**, each handling 14 PDF pages, read transaction rows with vision and emit them in a compact TSV format.
2. **Self-verification**: each agent re-reads its assigned pages and spot-checks at least 10 random rows against its own output, fixing any miscounted digits (1/7, 3/8, 2/7 are the common OCR confusions).
3. **Two independent audit agents** validate a random sample of 60 rows + the row-312 `1/6/2025` anomaly. Sampling pass rate was 61/61 → very high confidence.
4. **Assembly + sorting** into the final CSV with proper RFC-4180 quoting matching the original format.

The current `trump_278T.csv` is the result.

## How the build pipeline works

```
trump_278T.csv ──► scripts/build-dataset.mjs ──► src/data/dataset.json ──► React app
                          ▲
                          │
                  data/ticker-seed.json
```

`scripts/build-dataset.mjs` runs as a `predev` / `prebuild` step. It:

1. **Parses the CSV** with PapaParse.
2. **Normalizes** each `Description` string (see `src/lib/normalize.ts` for the matching client-side version):
   - Strips boilerplate phrases (`UNSOLICITED`, `SOLICITED ORDER DISCRETION EXERCISED`, `AVERAGE UNIT PRICE TRANSACTION`, `YOUR BROKER ACTED AS AGENT`, `ALLOCATED ORDER`, etc.).
   - Strips long internal trade IDs (`E17774834153032-00500`, etc.).
   - Strips share-denomination noise (`USD0.0001`, `EUR`, `ORD`).
   - Strips trailing class markers (`COM`, `CL A`, `CLASS B`, `SHS`, `REIT`, `NEW`, `INC NEW`, `DEL`, etc.).
   - Strips parentheticals like `(DELAWARE)` or `(HOLDING CO)`.
   - Applies known-bad OCR fixes (`PROCTOR → PROCTER`, `WATCH GROUP → MATCH GROUP`, etc.).
3. **Resolves** the canonical name to a ticker via `data/ticker-seed.json`:
   - Exact alias match → use the ticker.
   - Miss → fuzzy match with Fuse.js (threshold 0.25). Logs each fuzzy resolution.
   - Still no match → `UNKN-<slug>` placeholder. Listed in the `unresolved` array of the output.
4. **Aggregates** each ticker's transactions, totals (buy / sell / net / count), and date range.
5. **Aggregates sectors** the same way.
6. **Emits** `src/data/dataset.json` consumed by the React app.

`data/ticker-seed.json` is the **single source of truth** for ticker + sector mappings. It's a hand-curated + Yahoo-Finance-assisted dictionary keyed by ticker:

```json
{
  "MSFT": {
    "name": "Microsoft",
    "sector": "Technology",
    "aliases": ["MICROSOFT CORP", "MICROSOFT CORPORATION"]
  },
  …
}
```

The seed currently has **1,028 ticker entries** covering 100% of the disclosed volume. It was built up via several rounds of:
- Yahoo Finance bulk-resolution via the public search API (`query2.finance.yahoo.com/v1/finance/search`)
- Validating each ticker against Yahoo's `quoteType` + `sector` to filter out foreign exchange listings and non-equity matches
- Reversed-name fallback (so e.g. `LAUDER ESTEE COS` finds Estée Lauder = EL)
- Manual override for known-bad Yahoo matches (e.g., `AMP` is **Ameriprise**, not Amphenol — Amphenol is APH)

## Repo layout

```
trump-portfolio/
├── trump_278T.csv              # source data — PDF re-extracted via vision
├── data/
│   └── ticker-seed.json        # ticker → name + sector + aliases
├── scripts/
│   └── build-dataset.mjs       # CSV + seed → src/data/dataset.json
├── src/
│   ├── data/dataset.json       # build artifact (gitignored or committed)
│   ├── lib/
│   │   ├── normalize.ts        # mirror of the build script's normalize logic
│   │   ├── format.ts           # $ formatting helpers
│   │   ├── colors.ts           # diverging green/red color scale
│   │   └── dataset.ts          # typed import of dataset.json
│   ├── routes/
│   │   ├── Home.tsx            # heatmap + leaderboard + daily activity + KPIs
│   │   ├── Stock.tsx           # /stock/:ticker
│   │   └── Sector.tsx          # /sector/:sector
│   ├── components/
│   │   ├── SectorHeatmap.tsx   # visx treemap
│   │   ├── Leaderboard.tsx
│   │   ├── DailyActivityChart.tsx
│   │   ├── StockMonthlyChart.tsx
│   │   └── SiteSearch.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

## Running locally

```bash
npm install
npm run dev        # vite dev server on http://localhost:5173
                   # `predev` rebuilds dataset.json from CSV automatically
npm run build      # production build to dist/
npm run preview    # serve the production build
```

## Updating with a new filing

When OGE publishes a new 278-T:

1. **Download the PDF** to e.g. `/tmp/new-filing.pdf`.

2. **Re-extract every row to CSV** using vision (the rebuild approach described above). The cleanest path is the same one used to build this CSV: split the PDF into ~14-page chunks, run an extraction agent per chunk that emits TSV rows, concatenate, validate row-# contiguity, then write a clean CSV with PapaParse-compatible quoting. The audit pass is highly recommended.

   If the new filing is only a small periodic update (a handful of new transactions), it may be simpler to manually append rows to `trump_278T.csv`, preserving the column order: `#,Description,Type,Date,Notification Received Over 30 Days Ago,Amount` with Amount quoted.

3. **Update `data/ticker-seed.json`** if any new descriptions appear that aren't covered by existing aliases. Two ways to find gaps:

   - Run `npm run build:data` and look at the `unresolved` count printed in the summary. Then inspect the top unresolved entries in `src/data/dataset.json` by volume.
   - Re-run the Yahoo bulk-resolver script (kept locally during development at `/tmp/yf-bulk-resolve.py`) — it queries the public search API for each unresolved canonical and proposes additions to merge.

4. **Rebuild and verify**:

   ```bash
   npm run build:data        # rebuilds src/data/dataset.json
   ```

   The script prints transaction count, total volume, net flow, resolved/unresolved counts, and a sample of fuzzy matches. Confirm:
   - Resolved count ≈ unique tickers (no large unresolved tail).
   - Date range is sensible (no future dates beyond today).
   - Fuzzy matches look correct in the sample output.

5. **Commit and deploy** (Vercel auto-deploys from main, or run `npm run build` manually).

## Caveats

- **Amounts are ranges, not exact figures.** Every dollar value in this dashboard is a midpoint of the disclosed bucket (e.g., `$1,001 – $15,000` → $8,000.50). The error bars on the per-stock charts show the actual disclosed range.
- **Transaction types are reported, not assets-under-management.** Net flow shows the difference between disclosed *purchases* and *sales* in a period — it's not a portfolio balance.
- **The PDF was produced via Adobe Paper Capture OCR**, so even the source has some artifacts — for example "RALLIANT CORP" is what the OCR shows for what is presumably "RELIANT CORP". These OCR artifacts are preserved in the CSV's Description column for fidelity; the seed maps them to the correct ticker.

## License & data sourcing

The transaction data is public-record financial disclosure information published by the U.S. Office of Government Ethics. Dashboard code is unlicensed (treat as personal/educational use unless explicitly permitted).
