import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { LearnerRegister } from "@/components/khpos/ops/LearnerRegister";

export const metadata: Metadata = {
  title: "Learner register · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ campus?: string; filter?: string }>;
}) {
  const { organisationId } = await params;
  const { campus, filter } = await searchParams;
  if (!UUID_RE.test(organisationId)) notFound();
  return <LearnerRegister organisationId={organisationId} initialCampus={campus} initialFilter={filter} />;
}
