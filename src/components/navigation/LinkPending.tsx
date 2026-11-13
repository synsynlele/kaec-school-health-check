"use client";

import { useLinkStatus } from "next/link";

export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" aria-label="Opening page" className="block size-2 shrink-0 rounded-full bg-current motion-safe:animate-pulse" /> : null;
}
