"use client";

import { useEffect, useRef, useState } from "react";
import { formatSol } from "@/lib/sol";

type Props = { value: number; decimals?: number; durationMs?: number; delayMs?: number };

/**
 * Counts up to `value` once on mount. The server HTML already contains the
 * final number, so no-JS and reduced-motion users just see the real value.
 */
export function CountUp({ value, decimals = 4, durationMs = 1400, delayMs = 0 }: Props) {
  const [display, setDisplay] = useState(value);
  const frame = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let start = 0;
    const tick = (t: number) => {
      start ||= t + delayMs;
      const progress = Math.min(1, Math.max(0, (t - start) / durationMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, durationMs, delayMs]);

  return <span className="tabular-nums">{formatSol(display, { min: decimals, max: decimals })}</span>;
}
