// Shared catalogue of supported yield-snapshot dates. Used by:
//  - src/components/SnapshotSelect.tsx (the dropdown UI)
//  - src/routes/Stock.tsx (per-stock yield)
//  - src/components/PortfolioYield.tsx (portfolio-wide yield)
//  - scripts/build-portfolio-yield.mjs (build-time pre-computation)
//
// If you change this list, also update SNAPSHOT_DATES in the build script.

export type SnapshotOption = {
  date: string;
  label: string;
  blurb: string;
};

export const SNAPSHOT_OPTIONS: SnapshotOption[] = [
  {
    date: "2026-05-14",
    label: "Disclosure",
    blurb: "Date the most recent 278-T filing batch was publicly released.",
  },
  {
    date: "2026-03-31",
    label: "Q1 end",
    blurb: "Calendar Q1 2026 close — quarter-end mark.",
  },
];

export const DEFAULT_SNAPSHOT_DATE = SNAPSHOT_OPTIONS[0].date;
