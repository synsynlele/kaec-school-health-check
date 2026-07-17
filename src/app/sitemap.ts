import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: appUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: appUrl("/assessment"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: appUrl("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: appUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: appUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
