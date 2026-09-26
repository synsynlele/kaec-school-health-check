import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { canAccessKshcAssessment, kshcUserFromCookie } from "@/lib/kshc-access";
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
  const user = await kshcUserFromCookie();
  if (!user) redirect(`/account?next=${encodeURIComponent(`/report/${id}`)}`);
  if (!UUID_RE.test(id) || !(await canAccessKshcAssessment(id, user.email))) redirect("/account");
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
