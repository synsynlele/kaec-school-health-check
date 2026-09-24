import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LearnerProgressWorkspace } from "@/components/khpos/ops/LearnerProgressWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Learner Progress & Intervention · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposLearnerProgressPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <LearnerProgressWorkspace organisationId={organisationId} />;
}
