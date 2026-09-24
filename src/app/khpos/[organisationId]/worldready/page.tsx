import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorldReadyWorkspace } from "@/components/khpos/ops/WorldReadyWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "WorldReady Transition · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposWorldReadyPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <WorldReadyWorkspace organisationId={organisationId} />;
}
