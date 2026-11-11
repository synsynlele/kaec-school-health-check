"use client";

import { useEffect, useRef } from "react";

/**
 * Keep the active destination visible in any horizontally scrolling KHP-OS
 * navigation (school subpages, HQ work areas and platform administration).
 *
 * This is presentation-only. It does not navigate, mutate records, change
 * role permissions or impose a scrolling animation during page transitions.
 */
export function useActiveNavScroll<T extends HTMLElement>(
  activeKey: string,
  selector = '[aria-current="page"]',
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const row = ref.current;
    const selected = row?.querySelector<HTMLElement>(selector);
    if (!row || !selected || row.clientWidth === 0) return;
    const rowRect = row.getBoundingClientRect();
    const activeRect = selected.getBoundingClientRect();
    const horizontalOffset =
      activeRect.left - rowRect.left - (rowRect.width - activeRect.width) / 2;
    if (Math.abs(horizontalOffset) > 2) {
      row.scrollLeft += horizontalOffset;
    }
  }, [activeKey, selector]);
  return ref;
}
