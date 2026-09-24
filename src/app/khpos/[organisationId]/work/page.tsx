import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyWorkWorkspace } from "@/components/khpos/ops/MyWorkWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "My Work · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsWorkPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <MyWorkWorkspace organisationId={organisationId} />;
}
