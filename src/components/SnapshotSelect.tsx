import { useEffect, useRef, useState } from "react";
import { SNAPSHOT_OPTIONS } from "../lib/snapshot";

export default function SnapshotSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const selected = SNAPSHOT_OPTIONS.find((o) => o.date === value) ?? SNAPSHOT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block normal-case tracking-normal font-normal">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 bg-panel2 border border-border hover:border-accent2 text-ink px-2 py-1 leading-none text-[11px] sm:text-xs transition-colors"
      >
        <span className="font-mono">{selected.date}</span>
        <span className="text-muted">·</span>
        <span>{selected.label}</span>
        <svg
          viewBox="0 0 12 12"
          width="10"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={"text-muted transition-transform " + (open ? "rotate-180" : "")}
          aria-hidden="true"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full mt-1 z-30 min-w-[16rem] bg-panel border border-ink shadow-lg py-1"
        >
          {SNAPSHOT_OPTIONS.map((opt) => {
            const active = opt.date === value;
            return (
              <li key={opt.date}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.date);
                    setOpen(false);
                  }}
                  className={
                    "w-full text-left px-3 py-2 text-xs hover:bg-panel2 flex flex-col gap-0.5 " +
                    (active ? "bg-panel2" : "")
                  }
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-ink">{opt.date}</span>
                    <span className="text-ink">{opt.label}</span>
                    {active && <span className="ml-auto text-accent2 text-[10px]">✓</span>}
                  </span>
                  <span className="text-[10px] text-muted leading-snug">{opt.blurb}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
