import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/khpos",
    name: "KHP-OS | Schools",
    short_name: "KHP-OS",
    description:
      "KAEC Human Potential Operating System for governed school transformation, implementation, evidence and continuous improvement.",
    start_url: "/khpos",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f4fd8",
    orientation: "any",
    categories: ["education", "productivity", "business"],
    icons: [
      {
        src: "/khpos-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/khpos-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Open KHP-OS",
        short_name: "KHP-OS",
        url: "/khpos",
      },
      {
        name: "School account",
        short_name: "Account",
        url: "/account",
      },
    ],
  };
}
