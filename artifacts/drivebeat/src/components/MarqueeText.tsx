import { useRef, useEffect, useState } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  speed?: number; // seconds per 100px of text
}

export function MarqueeText({
  text,
  className = "",
  speed = 0.18,
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

  const duration = Math.max(3, measureRef.current
    ? (measureRef.current.scrollWidth / 100) * speed
    : text.length * 0.2
  );

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
