"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSchoolMenuRoles } from "@/components/khpos/SchoolWorkspaceNav";
import { financeFetch, useFinanceData, type FinanceCall } from "./FinanceControls";

export function FinanceTodayApprovals({ organisationId }: { organisationId: string }) {
  const roles = useSchoolMenuRoles();
  const enabled = Boolean(roles?.some(role=>role==="SCHOOL_CUSTODIAN" || role==="VISION_CUSTODIAN"));
  const call = useCallback<FinanceCall>((surface,action,input)=>financeFetch(organisationId,null,surface,action,input),[organisationId]);
  const { data } = useFinanceData<{ adjustments: number; statements: number }>(call,"report","attention",{},0,enabled);
  if (!data || (!data.adjustments && !data.statements)) return null;
  const base = "/khpos/"+organisationId+"/financial-health";
  return <section className="khpos-interface-card space-y-3 p-4">
    <h2 className="text-lg font-bold text-slate-950">Finance approvals</h2>
    <div className="flex flex-wrap gap-3">
      {!!data.adjustments && <Link href={base+"#approvals"} className="rounded-xl border px-4 py-3 text-sm font-bold text-brand-700">
        Review {data.adjustments} adjustment {data.adjustments===1?"request":"requests"}
      </Link>}
      {!!data.statements && <Link href={base+"#health"} className="rounded-xl border px-4 py-3 text-sm font-bold text-brand-700">
        Review {data.statements} Financial Health {data.statements===1?"statement":"statements"}
      </Link>}
    </div>
  </section>;
}
