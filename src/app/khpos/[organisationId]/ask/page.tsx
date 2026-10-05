import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskKhposWorkspace } from "@/components/khpos/ops/AskKhposWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Ask KHP-OS",
  robots: { index: false, follow: false },
};

export default async function AskKhposPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <AskKhposWorkspace organisationId={organisationId} />;
}
