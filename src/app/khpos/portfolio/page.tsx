import type { Metadata } from "next";
import { PortfolioIntelligenceWorkspace } from "@/components/khpos/PortfolioIntelligenceWorkspace";
import { AdminNav } from "@/components/khpos/AdminNav";

export const metadata: Metadata = {
  title: "KAEC Portfolio Intelligence | KHP-OS",
  robots: { index: false, follow: false },
};

export default function KhposPortfolioPage() {
  return (
    <>
      <AdminNav />
      <PortfolioIntelligenceWorkspace />
    </>
  );
}
