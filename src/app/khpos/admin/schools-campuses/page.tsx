import { SchoolsCampusesWorkspace } from "@/components/khpos/SchoolsCampusesWorkspace";
import { AdminNav } from "@/components/khpos/AdminNav";
export const metadata = { title: "Platform schools & campuses · KHP-OS", robots: { index: false, follow: false } };
export default function Page() { return <><AdminNav /><SchoolsCampusesWorkspace /></>; }
