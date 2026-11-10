import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { GateVisitorsWorkspace } from "@/components/khpos/ops/GateVisitorsWorkspace";
export const metadata:Metadata={title:"Gate & Visitors · KHP-OS",robots:{index:false,follow:false}};
export default async function GateVisitorsPage({params}:{params:Promise<{organisationId:string}>}){
  const {organisationId}=await params;
  if(!UUID_RE.test(organisationId))notFound();
  return <GateVisitorsWorkspace organisationId={organisationId}/>;
}
