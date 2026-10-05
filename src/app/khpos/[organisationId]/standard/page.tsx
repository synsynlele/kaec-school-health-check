import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KaecStandardWorkspace } from "@/components/khpos/ops/KaecStandardWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "KAEC Standard · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KaecStandardPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <KaecStandardWorkspace organisationId={organisationId} />;
}
