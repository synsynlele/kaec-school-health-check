"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";

export function AppBootScreen() {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    // Keep the server-rendered cover through hydration and the first content paint.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setBooting(false));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return booting ? <div data-app-boot style={{ position: "fixed", inset: 0, zIndex: 9999 }}><LoadingScreen /></div> : null;
}
