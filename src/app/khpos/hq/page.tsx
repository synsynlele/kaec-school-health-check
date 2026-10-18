import type { Metadata } from "next";
import { KaecHqWorkspace } from "@/components/khpos/KaecHqWorkspace";

export const metadata: Metadata = {
  title: "KAEC HQ | Corporate Operating Centre",
  description: "Restricted KAEC-NG corporate governance and operating workspace.",
  robots: { index: false, follow: false },
};

export default function KaecHqPage() {
  return <KaecHqWorkspace />;
}
