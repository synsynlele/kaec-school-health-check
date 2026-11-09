import { ReportsWorkspace } from "@/components/khpos/ReportsWorkspace";
export const metadata = { title: "Reports · KHP-OS", robots: { index: false, follow: false } };
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
