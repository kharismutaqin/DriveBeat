import { useRef, useEffect, useState } from "react";

// ============================================================
// ADJUST THIS VALUE to control marquee scroll speed
// This is pixels scrolled per second. Larger = faster scroll.
// ============================================================
const SCROLL_SPEED_PX_PER_SEC = 30;

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
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const check = () => {
      const needsScroll = measure.scrollWidth > container.clientWidth + 2;
      setShouldScroll(needsScroll);
      if (needsScroll) {
        setTextWidth(measure.scrollWidth);
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  // Fixed pixel speed: all marquees move at the same px/sec regardless
  // of text length or container width. Duration auto-adjusts.
  const gap = 32; // pr-8 = 32px gap between duplicated text
  const duration = textWidth > 0
    ? (textWidth + gap) / SCROLL_SPEED_PX_PER_SEC
    : 12;

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
          style={{ animationDuration: `${duration}s` }}
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
