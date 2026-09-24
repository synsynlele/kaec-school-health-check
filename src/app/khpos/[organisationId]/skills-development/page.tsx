import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkillsDevelopmentWorkspace } from "@/components/khpos/ops/SkillsDevelopmentWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Skills Development · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposSkillsDevelopmentPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <SkillsDevelopmentWorkspace organisationId={organisationId} />;
}
