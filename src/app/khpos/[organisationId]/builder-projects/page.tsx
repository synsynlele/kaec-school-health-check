import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuilderProjectsWorkspace } from "@/components/khpos/ops/BuilderProjectsWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Builder Projects & Defence · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsBuilderProjectsPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <BuilderProjectsWorkspace organisationId={organisationId} />;
}
