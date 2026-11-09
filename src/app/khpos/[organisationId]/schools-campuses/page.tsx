import { SchoolsCampusesWorkspace } from "@/components/khpos/SchoolsCampusesWorkspace";
export const metadata = { title: "Schools & campuses · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({params}: {params: Promise<{organisationId: string}>}) {
 const {organisationId} = await params;
 return <SchoolsCampusesWorkspace key={organisationId} organisationId={organisationId} />;
}
