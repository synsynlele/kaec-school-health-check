import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const read=(p)=>fs.readFileSync(p,"utf8");
const shared=read("src/lib/khpos/ops/school-financial-shared.ts");
const exports={};
vm.runInNewContext(ts.transpileModule(shared,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require(name){if(name==="zod")return require("zod");throw new Error("Unexpected import: "+name);},
  Date,Intl,Math,Number,
});
const {deriveFinancialHealth,financialInputSchema}=exports;
const item=(id,start,end,fee,other,expenses,cash,unpaid,status="approved")=>({
  id,school_id:"school-a",period_start:start,period_end:end,
  fee_income:fee,other_income:other,operating_expenses:expenses,
  cash_available:cash,outstanding_fees:unpaid,
  learner_count:85,school_capacity:120,break_even_target:75,status,
});
const months=[
  item("jan","2026-01-01","2026-01-31",1000000,50000,800000,300000,150000),
  item("feb","2026-02-01","2026-02-28",850000,50000,750000,350000,100000),
  item("mar","2026-03-01","2026-03-31",900000,20000,1000000,250000,220000),
];
let result=deriveFinancialHealth(months,"2026-01-01","2026-03-31");
assert.equal(result.complete,true);
assert.equal(result.periods,3);
assert.equal(result.feeIncome,2750000);
assert.equal(result.otherIncome,120000);
assert.equal(result.operatingExpenses,2550000);
assert.equal(result.operatingResult,320000);
assert.equal(result.cashAvailable,250000,"Last statement closing balance must not be summed");
assert.equal(result.outstandingFees,220000,"Outstanding fees are a snapshot, not term revenue");
assert.equal(result.breakEvenTarget,75,"Break-even target comes from school budget");
assert.equal(result.operatingMargin,11.1);
result=deriveFinancialHealth([months[0],months[2]],"2026-01-01","2026-03-31");
assert.equal(result.complete,false);
assert.match(result.missing[0],/2026-02-01 to 2026-02-28/);
result=deriveFinancialHealth([{...months[1],status:"submitted"}],"2026-02-01","2026-02-28");
assert.equal(result.complete,false,"Unapproved finance must never enter investor reports");
assert.equal(result.feeIncome,0);
result=deriveFinancialHealth(months,"2026-01-15","2026-03-15");
assert.equal(result.complete,false,"Partial opening and closing months must be marked uncovered");
const parsed=financialInputSchema.safeParse({
  periodStart:"2026-11-01",periodEnd:"2026-11-30",
  feeIncome:50000,otherIncome:0,operatingExpenses:90000,
  cashAvailable:0,outstandingFees:80000,learnerCount:50,schoolCapacity:90,
  breakEvenTarget:null,sourceNote:"Finance ledger 2026 November and bank reconciliation",
  managementNote:"Cash below target",
});
assert.equal(parsed.success,true,"Losses are legitimate; nonnegative inputs only");
assert.equal(financialInputSchema.safeParse({...parsed.data,feeIncome:-10}).success,false);
assert.equal(financialInputSchema.safeParse({...parsed.data,periodStart:"2026-12-31"}).success,false);

const model=read("src/lib/khpos/ops/school-financial-health.ts");
const api=read("src/app/api/khpos/ops/financial-health/[id]/route.ts");
const nav=read("src/components/khpos/SchoolWorkspaceNav.tsx");
const panel=read("src/components/khpos/ops/CustodianInvestorReportsPanel.tsx");
const report=read("src/lib/khpos/ops/custodian-investor-reports.ts");
const reportApi=read("src/app/api/khpos/ops/investor-reports/[id]/route.ts");
const sql=read("supabase/migrations/20261119112500_school_financial_health.sql");
for(const re of [/organisation_memberships/,/partner_entitlements/,/khpos_ops_role_assignments/,/FINANCE_ADMIN_OFFICER/,/SCHOOL_CUSTODIAN/,/canApprove/,/\.eq\("school_id",schoolId\)/,/\.eq\("status","approved"\)/,/\.eq\("status",mode==="submit"\?record.status:"submitted"\)/])
  assert.match(model,re);
assert.match(api,/requireFinancialHealthAccess\(schoolId,user.id\)/);
assert.match(api,/private, no-store/);
assert.match(nav,/financial-health/);
assert.match(nav,/if \(route === "\/financial-health"\) return roles\.some/);
assert.match(panel,/readOnly required/);
assert.match(panel,/summary:"1"/);
assert.match(report,/financialSummaryForDates\(schoolId,draft.period_start,draft.period_end\)/);
assert.match(report,/if\(!summary.complete\)throw new CustodianReportError/);
assert.match(report,/financeSourcePeriodIds/);
assert.match(reportApi,/financialSummaryForDates/);
assert.match(sql,/enable row level security/gi);
assert.match(sql,/revoke all on public\.khpos_school_financial_periods from public,anon,authenticated/);
assert.match(sql,/exclude using gist/);
assert.match(sql,/OLD.status = 'approved'/);
assert.match(sql,/after insert or update/);
console.log("School financial health: calculation, period coverage, approval boundary, read isolation and frozen reporting regression passed.");
