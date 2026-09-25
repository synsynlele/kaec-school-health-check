import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { CampusReadinessWorkspace } from "@/components/khpos/ops/CampusReadinessWorkspace";

export const metadata: Metadata = { title: "Campus Readiness · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <CampusReadinessWorkspace organisationId={organisationId} />;
}
