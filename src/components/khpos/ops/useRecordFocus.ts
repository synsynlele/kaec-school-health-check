"use client";

import { useEffect } from "react";
import { focusKhposRecord } from "@/lib/khpos/ops/record-links";

export function useRecordFocus(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const focus = () => focusKhposRecord(window.location.hash, document);
    focus();
    window.addEventListener("hashchange", focus);
    return () => window.removeEventListener("hashchange", focus);
  }, [ready]);
}
