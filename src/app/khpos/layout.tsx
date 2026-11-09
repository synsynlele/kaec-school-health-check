import type { ReactNode } from "react";

/**
 * One visual, keyboard and mobile accessibility system for school, HQ and
 * platform-administration pages. Authorisation is still enforced per route/API.
 */
export default function KhposPlatformLayout({ children }: { children: ReactNode }) {
  return <div className="khpos-platform-ui min-h-screen">{children}</div>;
}
