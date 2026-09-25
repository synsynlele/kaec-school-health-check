import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SafeguardingWorkspace } from "@/components/khpos/ops/SafeguardingWorkspace";

export const metadata: Metadata = { title: "Safeguarding · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <SafeguardingWorkspace organisationId={organisationId} />;
}
