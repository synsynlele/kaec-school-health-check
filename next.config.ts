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
        headers: privateSecurityHeaders,
      },
      {
        source: "/api/khpos/:path*",
        headers: privateSecurityHeaders,
      },
      ...["/khpos/:organisationId/teaching-presence", "/khpos/hq/schools"].map(source => ({
        source,
        headers: privateSecurityHeaders.map(header => header.key === "Permissions-Policy"
          ? { ...header, value: header.value.replace("geolocation=()", "geolocation=(self)") }
          : header),
      })),
    ];
  },
};

export default nextConfig;
