import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstitutionalLibrary } from "@/components/khpos/ops/InstitutionalLibrary";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Institutional Library · KHP-OS",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function KhposOperationsLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    q?: string | string[];
    critical?: string | string[];
  }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  const query = await searchParams;
  const requestedTab = first(query.tab);
  const initialTab =
    requestedTab === "processes" || requestedTab === "tools"
      ? requestedTab
      : "policies";
  const initialQuery = (first(query.q) ?? "").trim().slice(0, 120);
  const initialCriticalOnly = first(query.critical) === "missing";

  return (
    <InstitutionalLibrary
      organisationId={organisationId}
      initialTab={initialTab}
      initialQuery={initialQuery}
      initialCriticalOnly={initialCriticalOnly}
    />
  );
}
