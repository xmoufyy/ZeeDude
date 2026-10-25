"use client";

import { useEffect, useRef } from "react";

/**
 * The past-race picker list. On phones it's a horizontal scroller, so the
 * selected race is scrolled into view (e.g. after opening a shared link to an
 * old race). Only the list scrolls; the page stays put.
 */
export function RaceList({ selectedId, children }: { selectedId: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = ref.current;
    const item = list?.querySelector('[aria-current="page"]')?.closest("li");
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const box = list.getBoundingClientRect();
    const at = item.getBoundingClientRect();
    if (at.left < box.left || at.right > box.right) {
      list.scrollLeft += at.left - box.left - (box.width - at.width) / 2;
    }
  }, [selectedId]);

  return (
    <ul ref={ref} className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {children}
    </ul>
  );
}
