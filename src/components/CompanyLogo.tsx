import { useEffect, useState } from "react";

type Ext = "png" | "svg" | "none";

/**
 * Renders a pre-fetched company logo from /logos/{ticker}.{png|svg}.
 * Tries PNG first, falls back to SVG on error, then hides itself entirely.
 * Pass any extra `className` to size/frame it from the caller.
 */
export default function CompanyLogo({
  ticker,
  className = "",
  alt,
}: {
  ticker: string;
  className?: string;
  alt?: string;
}) {
  const [ext, setExt] = useState<Ext>("png");

  // Reset probe when the ticker changes.
  useEffect(() => { setExt("png"); }, [ticker]);

  if (ext === "none") return null;
  return (
    <img
      key={`${ticker}-${ext}`}
      src={`/logos/${encodeURIComponent(ticker)}.${ext}`}
      alt={alt ?? ""}
      className={className}
      onError={() => setExt((e) => (e === "png" ? "svg" : "none"))}
      loading="lazy"
      decoding="async"
    />
  );
}
