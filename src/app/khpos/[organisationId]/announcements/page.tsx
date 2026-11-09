import {AnnouncementsWorkspace} from "@/components/khpos/AnnouncementsWorkspace";
export const metadata = { title: "School announcements · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({params}:{params:Promise<{organisationId:string}>}){const {organisationId}=await params;return <AnnouncementsWorkspace key={organisationId} organisationId={organisationId}/>;}
