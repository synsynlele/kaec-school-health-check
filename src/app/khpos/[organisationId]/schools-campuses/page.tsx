import { SchoolsCampusesWorkspace } from "@/components/khpos/SchoolsCampusesWorkspace";
export default async function Page({params}: {params: Promise<{organisationId: string}>}) {
 const {organisationId} = await params;
 return <SchoolsCampusesWorkspace key={organisationId} organisationId={organisationId} />;
}
