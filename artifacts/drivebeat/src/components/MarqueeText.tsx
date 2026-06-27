import { useRef, useEffect, useState } from "react";

// ============================================================
// ADJUST THIS VALUE to control marquee scroll speed (seconds)
// Larger = slower, Smaller = faster
// ============================================================
const MARQUEE_DURATION_SECONDS = 12;

interface MarqueeTextProps {
  text: string;
  className?: string;
}

export function MarqueeText({
  text,
  className = "",
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      setShouldScroll(measure.scrollWidth > container.clientWidth + 2); // +2px tolerance
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      {/* Hidden measurement element */}
      <span
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none whitespace-nowrap"
        aria-hidden="true"
      >
        {text}
      </span>

      {shouldScroll ? (
        <div
          className="flex whitespace-nowrap animate-marquee"
          style={{ animationDuration: `${MARQUEE_DURATION_SECONDS}s` }}
        >
          <span className="shrink-0 pr-8">{text}</span>
          <span className="shrink-0 pr-8">{text}</span>
        </div>
      ) : (
        <span className="truncate block">{text}</span>
      )}
    </div>
  );
}
