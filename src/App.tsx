import { useEffect, useMemo, useRef } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Home from "./routes/Home";
import Stock from "./routes/Stock";
import Sector from "./routes/Sector";
import Day from "./routes/Day";
import Sitemap from "./routes/Sitemap";
import SiteSearch from "./components/SiteSearch";

type NavMode = "in" | "out" | "across";

function depth(path: string): number {
  if (path === "/") return 0;
  return path.split("/").filter(Boolean).length;
}

function compareDirection(from: string, to: string): NavMode {
  if (from === to) return "in";
  const a = depth(from);
  const b = depth(to);
  if (b > a) return "in";
  if (b < a) return "out";
  return "across";
}

const EASE = [0.22, 1, 0.36, 1] as const;

const VARIANTS: Record<NavMode, {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit:    Record<string, number>;
  transition: { duration: number; ease: typeof EASE };
}> = {
  in: {
    initial: { opacity: 0, scale: 0.985, y: 18 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit:    { opacity: 0, scale: 1.015, y: -12 },
    transition: { duration: 0.36, ease: EASE },
  },
  out: {
    initial: { opacity: 0, scale: 1.015, y: -12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit:    { opacity: 0, scale: 0.985, y: 18 },
    transition: { duration: 0.36, ease: EASE },
  },
  across: {
    initial: { opacity: 0, x: 36 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -36 },
    transition: { duration: 0.30, ease: EASE },
  },
};

function Page({
  mode,
  reduceMotion,
  children,
}: {
  mode: NavMode;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  if (reduceMotion) {
    return <div>{children}</div>;
  }

  const v = VARIANTS[mode];
  return (
    <motion.div
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={v.transition}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const prevPathRef = useRef<string>(location.pathname);
  const reduceMotion = useReducedMotion();

  const mode = useMemo<NavMode>(
    () => compareDirection(prevPathRef.current, location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    prevPathRef.current = location.pathname;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  const routes = (
    <Routes location={location} key={reduceMotion ? undefined : location.pathname}>
      <Route path="/"               element={<Page mode={mode} reduceMotion={!!reduceMotion}><Home /></Page>} />
      <Route path="/stock/:ticker"  element={<Page mode={mode} reduceMotion={!!reduceMotion}><Stock /></Page>} />
      <Route path="/sector/:sector" element={<Page mode={mode} reduceMotion={!!reduceMotion}><Sector /></Page>} />
      <Route path="/day/:date"      element={<Page mode={mode} reduceMotion={!!reduceMotion}><Day /></Page>} />
      <Route path="/sitemap"        element={<Page mode={mode} reduceMotion={!!reduceMotion}><Sitemap /></Page>} />
    </Routes>
  );

  if (reduceMotion) {
    return routes;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {routes}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-6">
          <Link
            to="/"
            className="logo-shine group text-ink px-0 sm:px-0 py-1 hover:text-accent2 transition-colors font-serif shrink-0"
          >
            <div className="text-lg sm:text-2xl tracking-[0.16em] sm:tracking-[0.18em] font-medium leading-none">TRUMP</div>
            <div className="text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.22em] text-accent2 group-hover:text-ink transition-colors mt-0.5">PORTFOLIO DASHBOARD</div>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1 justify-end">
            <SiteSearch />
            <span className="hidden xl:inline text-[11px] tracking-[0.18em] uppercase text-muted whitespace-nowrap">
              2026 PTR · Midpoint Estimates
            </span>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-x-clip">
        <AnimatedRoutes />
      </main>
      <footer className="border-t border-border mt-12 bg-panel2/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 sm:py-5 text-[11px] tracking-[0.12em] uppercase text-muted flex items-center justify-between gap-3 flex-wrap">
          <span>Based on public OGE filings · Recreational project · Not financial advice</span>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <a
              href="https://x.com/hd_nvim"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent2"
            >
              Vibed by Herrington Darkholme
            </a>
            <Link to="/sitemap" className="hover:text-accent2">Sitemap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
