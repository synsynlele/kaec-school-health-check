import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { ImplementationWorkspace } from "@/components/khpos/ImplementationWorkspace";

export const metadata: Metadata = {
  title: "Implementation Automation | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposImplementationPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return (
    <>
      <ImplementationWorkspace organisationId={organisationId} />
      <Link
        href={`/khpos/${organisationId}/evidence`}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-mint-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-xl transition hover:bg-mint-200"
      >
        Evidence & Verification
      </Link>
    </>
  );
}
