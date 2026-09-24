import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademicAssuranceWorkspace } from "@/components/khpos/ops/AcademicAssuranceWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Assessment & Exams · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsAcademicAssurancePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <AcademicAssuranceWorkspace organisationId={organisationId} />;
}
