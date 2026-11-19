import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { TextEncoder, TextDecoder } from "node:util";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const read=(path)=>fs.readFileSync(path,"utf8");
const model=read("src/lib/khpos/ops/custodian-investor-reports.ts");
const api=read("src/app/api/khpos/ops/investor-reports/[id]/route.ts");
const panel=read("src/components/khpos/ops/CustodianInvestorReportsPanel.tsx");
const reports=read("src/components/khpos/ReportsWorkspace.tsx");
const migration=read("supabase/migrations/20261119103500_custodian_investor_reports.sql");
const readiness=read("supabase/migrations/20261119103000_learning_readiness_only_teaching_days.sql");
assert.match(model,/SCHOOL_CUSTODIAN/);
assert.match(model,/organisation_memberships/);
assert.match(model,/khpos_ops_role_assignments/);
assert.match(model,/partner_entitlements/);
assert.match(model,/\.eq\("school_id",schoolId\)/);
assert.match(model,/\.eq\("status","draft"\)/);
assert.match(api,/requireSchoolCustodian\(id,user\.id\)/);
assert.match(api,/verifyKhposAccessToken/);
assert.match(api,/Content-Disposition/);
assert.match(api,/private, no-store/);
assert.match(panel,/if\(!allowed\)return null/);
assert.match(panel,/response\.status===403/);
assert.match(panel,/Download Word \(\.docx\)/);
assert.match(reports,/CustodianInvestorReportsPanel/);
assert.match(migration,/enable row level security/i);
assert.match(migration,/revoke all on table public\.khpos_custodian_investor_reports from public, anon, authenticated/i);
assert.doesNotMatch(migration,/create policy/i);
for(const requirement of [
  /RCR-ACD-004-TEACHER/, /stream\.teacher_assignment_id = a\.id/,
  /period\.weekday = extract\(isodow from v_occurrence_date\)/,
  /period\.is_active = true/,/stream\.status = 'active'/,
  /work\.status = 'pending'/,/status = 'cancelled'/,
]) assert.match(readiness,requirement);
assert.doesNotMatch(readiness,/update public\.khpos_ops_staff_day_presence/i);
console.log("Custodian report access, immutable approval, PDF/Word access and timetable readiness guards passed.");

const source=read("src/lib/khpos/ops/custodian-report-export.ts");
const exports={}, sample={
  id:"r",school_id:"s",term_label:"2026/27 Term 1",period_start:"2026-09-01",
  period_end:"2026-12-17",status:"approved",approved_at:"2026-12-20T12:00:00Z",
  data:{feeIncome:1000000,otherIncome:50000,operatingExpenses:700000,cashAvailable:400000,
    outstandingFees:200000,learnerCount:60,schoolCapacity:120,
    operationalHighlights:"Work, issues and decisions were tracked at school level.",
    learningHighlights:"Measured improvements were reviewed & approved.",
    managementRisks:"A short-term cash pressure has been escalated to management.",
    nextTermPriorities:"Protect operations and improve retention each month.",
    financialSourceNotes:"Based on the reviewed finance ledger & fee collection register.",
  },
};
const sandbox={exports,require(name){
  if(name==="pdf-lib")return require("pdf-lib");
  if(name==="./custodian-report-shared")return {custodianReportTotals:(d)=>{
    const income=d.feeIncome+d.otherIncome;
    return {income,operatingResult:income-d.operatingExpenses,occupancy:Math.round(d.learnerCount/d.schoolCapacity*1000)/10};
  }};
  throw new Error("Unexpected dependency "+name);
},TextEncoder,DataView,Uint8Array,Date,Intl,Math,Number,Promise};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
const docx=exports.makeCustodianReportDocx(sample,"KAEC School & Partners");
assert.equal(Buffer.from(docx).toString("ascii",0,2),"PK");
const dv=new DataView(docx.buffer,docx.byteOffset,docx.byteLength);
let offset=0,documentXml="";
for(let j=0;j<10&&dv.getUint32(offset,true)===0x04034b50;j++){
  const nameLen=dv.getUint16(offset+26,true),dataLen=dv.getUint32(offset+18,true),extraLen=dv.getUint16(offset+28,true);
  const name=new TextDecoder().decode(docx.subarray(offset+30,offset+30+nameLen));
  const start=offset+30+nameLen+extraLen;
  if(name==="word/document.xml")documentXml=new TextDecoder().decode(docx.subarray(start,start+dataLen));
  offset=start+dataLen;
}
assert.match(documentXml,/w:document/);
assert.match(documentXml,/CUSTODIAN APPROVED/);
assert.match(documentXml,/&amp;/);
assert.match(documentXml,/2026\/27 Term 1/);
const pdf=await exports.makeCustodianReportPdf(sample,"KAEC School & Partners");
const {PDFDocument}=require("pdf-lib");
const loaded=await PDFDocument.load(pdf);
assert(loaded.getPageCount()>=1);
assert.equal(Buffer.from(pdf).toString("ascii",0,4),"%PDF");
console.log("Custodian PDF and real DOCX export smoke tests passed.");
