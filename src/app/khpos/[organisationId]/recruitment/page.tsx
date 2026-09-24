import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecruitmentWorkspace } from "@/components/khpos/ops/RecruitmentWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Workforce & Recruitment · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposRecruitmentPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <RecruitmentWorkspace organisationId={organisationId} />;
}
