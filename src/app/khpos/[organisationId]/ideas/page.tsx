import { notFound } from "next/navigation";
import { IdeasBoard } from "@/components/khpos/ops/IdeasBoard";
import { UUID_RE } from "@/lib/http";

export const metadata = { title: "Ideas & discussions · KHP-OS", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <IdeasBoard scope={organisationId} />;
}
