import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadershipFinancialWorkspace } from "@/components/khpos/ops/LeadershipFinancialWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Leadership & Financial Capability · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsLeadershipFinancialPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <LeadershipFinancialWorkspace organisationId={organisationId} />;
}
