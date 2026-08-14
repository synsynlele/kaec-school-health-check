import type { Metadata } from "next";
import { AdminConsoleWorkspace } from "@/components/khpos/AdminConsoleWorkspace";

export const metadata: Metadata = {
  title: "Admin Console | KHP-OS",
  robots: { index: false, follow: false },
};

export default function KhposAdminPage() {
  return <AdminConsoleWorkspace />;
}
