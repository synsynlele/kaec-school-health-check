"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingScreen } from "./LoadingScreen";

export function AppBootScreen() {
  const pathname = usePathname();
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    // Keep the server-rendered cover through hydration and the first content paint.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setBooting(false));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // KHP-OS owns its full-screen route and data loader; never mount a second
  // hydration cover above it. Other KAEC applications keep this startup cover.
  if (pathname?.startsWith("/khpos")) return null;

  return booting ? <div data-app-boot style={{ position: "fixed", inset: 0, zIndex: 9999 }}><LoadingScreen /></div> : null;
}
