import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import {
  upgradeStoredReportIfNeeded,
  type ReportUpgradeResult,
} from "@/lib/report-upgrade";

export const maxDuration = 120;

export default async function ReportUpgradeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let result: ReportUpgradeResult | null = null;

  if (UUID_RE.test(id)) {
    try {
      result = await upgradeStoredReportIfNeeded(id);
    } catch (error) {
      console.error("[kshc][report_upgrade] automatic AI upgrade failed", {
        assessmentId: id,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  if (result === "upgraded") {
    redirect(`/report/${id}?ai=upgraded`);
  }

  return children;
}
