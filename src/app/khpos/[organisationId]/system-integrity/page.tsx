import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SystemIntegrityWorkspace } from "@/components/khpos/ops/SystemIntegrityWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "System Integrity · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function SystemIntegrityPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <SystemIntegrityWorkspace organisationId={organisationId} />;
}
