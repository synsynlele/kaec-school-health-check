import { ReportsWorkspace } from "@/components/khpos/ReportsWorkspace";
export default async function Page({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  return (
    <ReportsWorkspace key={organisationId} organisationId={organisationId} />
  );
}
