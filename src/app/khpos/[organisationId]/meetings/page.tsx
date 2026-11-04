import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { MeetingsWorkspace } from "@/components/khpos/ops/MeetingsWorkspace";
export const metadata = { title: "Private meetings · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({params,searchParams}:{params:Promise<{organisationId:string}>;searchParams:Promise<{meeting?:string}>}) {
  const {organisationId} = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  const query=await searchParams;
  const initialMeeting=query.meeting&&UUID_RE.test(query.meeting)?query.meeting:"";
  return <MeetingsWorkspace organisationId={organisationId} initialMeeting={initialMeeting}/>;
}
