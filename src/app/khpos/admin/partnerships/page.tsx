import type { Metadata } from "next";
import { PartnerRegistryWorkspace } from "@/components/khpos/PartnerRegistryWorkspace";

export const metadata: Metadata = {
  title: "Partnership Registry | KHP-OS Admin",
  robots: { index: false, follow: false },
};

export default function PartnershipRegistryPage() {
  return <PartnerRegistryWorkspace />;
}
