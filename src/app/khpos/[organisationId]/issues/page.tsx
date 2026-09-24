import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IssuesWorkspace } from "@/components/khpos/ops/IssuesWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Issues & Escalations · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsIssuesPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <IssuesWorkspace organisationId={organisationId} />;
}
