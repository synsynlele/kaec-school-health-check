import {AnnouncementsWorkspace} from "@/components/khpos/AnnouncementsWorkspace";
export default async function Page({params}:{params:Promise<{organisationId:string}>}){const {organisationId}=await params;return <AnnouncementsWorkspace key={organisationId} organisationId={organisationId}/>;}
