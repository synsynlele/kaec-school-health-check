import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolFinancialHealthWorkspace } from "@/components/khpos/ops/SchoolFinancialHealthWorkspace";

export const metadata: Metadata = {
  title: "School Financial Health · KHP-OS",
  robots: { index: false, follow: false },
};
export default async function Page({params}:{params:Promise<{organisationId:string}>}){
  const {organisationId}=await params;
  if(!UUID_RE.test(organisationId))notFound();
  return <SchoolFinancialHealthWorkspace organisationId={organisationId} />;
}
