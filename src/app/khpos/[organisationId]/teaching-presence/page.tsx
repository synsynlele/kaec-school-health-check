import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { TeacherPresenceWorkspace } from "@/components/khpos/ops/TeacherPresenceWorkspace";
export const metadata: Metadata = {
  title: "School Attendance & Lessons · KHP-OS",
  robots: { index:false, follow:false }
};
export default async function PresencePage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ organisationId }, { tab }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(organisationId)) notFound();
  const initialTab = tab === "lessons" ? "lessons" : "day";
  return <TeacherPresenceWorkspace key={initialTab} organisationId={organisationId} initialTab={initialTab} />;
}
