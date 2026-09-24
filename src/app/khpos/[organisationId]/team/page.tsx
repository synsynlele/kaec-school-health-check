import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperationsTeamWorkspace } from "@/components/khpos/ops/OperationsTeamWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Team & Roles · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsTeamPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <OperationsTeamWorkspace organisationId={organisationId} />;
}
