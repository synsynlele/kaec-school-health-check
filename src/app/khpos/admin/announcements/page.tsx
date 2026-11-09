import {AnnouncementsWorkspace} from "@/components/khpos/AnnouncementsWorkspace";
import {AdminNav} from "@/components/khpos/AdminNav";
export const metadata = { title: "Platform announcements · KHP-OS", robots: { index: false, follow: false } };
export default function Page(){return <><AdminNav/><AnnouncementsWorkspace/></>;}
