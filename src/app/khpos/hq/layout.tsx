import type { ReactNode } from "react";
import { HqSectionNavigation } from "@/components/khpos/HqSectionNavigation";

export default function KhposHqLayout({ children }: { children: ReactNode }) {
  return (
    <div className="khpos-hq-shell min-h-screen">
      <HqSectionNavigation />
      {children}
    </div>
  );
}
