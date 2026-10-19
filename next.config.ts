import type { NextConfig } from "next";

const privateSecurityHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/khpos/:path*",
        // App Router navigation reuses the opening document's policy. Allow
        // same-origin requests throughout the app; only attendance taps ask.
        headers: privateSecurityHeaders.map(header => header.key === "Permissions-Policy"
          ? { ...header, value: header.value.replace("geolocation=()", "geolocation=(self)") }
          : header),
      },
      {
        source: "/api/khpos/:path*",
        headers: privateSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
