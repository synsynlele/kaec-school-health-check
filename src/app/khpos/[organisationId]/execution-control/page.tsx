import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExecutionControlWorkspace } from "@/components/khpos/ops/ExecutionControlWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Task setup · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function ExecutionControlPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <ExecutionControlWorkspace organisationId={organisationId} />;
}
