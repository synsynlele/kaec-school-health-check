import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { ExtendedWorkspace } from "@/components/khpos/ops/ExtendedWorkspace";

export const metadata: Metadata = { title: "Network Pulse · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <ExtendedWorkspace organisationId={organisationId} type="network-pulse" />;
}
