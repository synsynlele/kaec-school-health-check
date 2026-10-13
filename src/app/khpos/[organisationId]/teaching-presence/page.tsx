import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { TeacherPresenceWorkspace } from "@/components/khpos/ops/TeacherPresenceWorkspace";
export const metadata: Metadata = {
  title: "School Attendance & Teaching Delivery · KHP-OS",
  robots: { index:false, follow:false }
};
export default async function PresencePage({params}:{params:Promise<{organisationId:string}>}) {
  const {organisationId}=await params;
  if(!UUID_RE.test(organisationId)) notFound();
  return <TeacherPresenceWorkspace organisationId={organisationId}/>;
}
