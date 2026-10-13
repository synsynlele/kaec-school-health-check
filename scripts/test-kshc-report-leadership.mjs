import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

// Test the real server-side TypeScript module with an isolated, in-memory
// Supabase query stub. No live user, school or diagnostic record is changed.
const org="00000000-0000-0000-0000-000000000001";
const otherOrg="00000000-0000-0000-0000-000000000002";
const suspendedOrg="00000000-0000-0000-0000-000000000003";
const userTeacher="00000000-0000-0000-0000-000000000010";
const userCustodian="00000000-0000-0000-0000-000000000011";
const userGuardian="00000000-0000-0000-0000-000000000012";
const userAcademic="00000000-0000-0000-0000-000000000013";
const userSkills="00000000-0000-0000-0000-000000000014";
const userPromoterTeacher="00000000-0000-0000-0000-000000000015";
const userWrongSchool="00000000-0000-0000-0000-000000000016";
const userExpired="00000000-0000-0000-0000-000000000017";
const userUnauthorised="00000000-0000-0000-0000-000000000018";
const reportLinked="00000000-0000-0000-0000-000000000101";
const reportUnlinked="00000000-0000-0000-0000-000000000102";
const reportOther="00000000-0000-0000-0000-000000000103";
const reportSuspended="00000000-0000-0000-0000-000000000104";

const membership=(user_id,organisation_id=org)=>({user_id,organisation_id,status:"active"});
const assignment=(user_id,role_id,status="active")=>({user_id,role_id,status});
const role=(id,organisation_id,category)=>({id,organisation_id,category,status:"active"});

const tables={
 organisations:[
  {id:org,status:"active",partner_status:"active"},
  {id:otherOrg,status:"active",partner_status:"active"},
  {id:suspendedOrg,status:"active",partner_status:"suspended"},
 ],
 organisation_memberships:[
  ...[userTeacher,userCustodian,userGuardian,userAcademic,userSkills,userPromoterTeacher,userWrongSchool,userExpired].map(u=>membership(u)),
  membership(userWrongSchool,otherOrg),
  membership(userCustodian,suspendedOrg),
 ],
 khpos_ops_role_assignments:[
  assignment(userTeacher,"teacher"),
  assignment(userCustodian,"custodian"),
  assignment(userGuardian,"guardian"),
  assignment(userAcademic,"academic"),
  assignment(userSkills,"skills"),
  assignment(userPromoterTeacher,"teacher"),
  assignment(userPromoterTeacher,"promoter"),
  assignment(userWrongSchool,"otherCustodian"),
  assignment(userExpired,"custodian","ended"),
 ],
 khpos_ops_roles:[
  role("teacher",org,"learner_facing"),
  role("custodian",org,"leadership"),
  role("guardian",org,"leadership"),
  role("academic",org,"academic_leadership"),
  role("skills",org,"skills_leadership"),
  role("promoter",org,"section_leadership"),
  role("otherCustodian",otherOrg,"leadership"),
 ],
 assessments:[
  {id:reportLinked,organisation_id:org,status:"completed",completed_at:"2026-10-01"},
  {id:reportUnlinked,organisation_id:null,status:"completed",completed_at:"2026-10-02"},
  {id:reportOther,organisation_id:otherOrg,status:"completed",completed_at:"2026-10-03"},
  {id:reportSuspended,organisation_id:suspendedOrg,status:"completed",completed_at:"2026-10-04"},
 ],
};

function query(table) {
  let values=tables[table]??[];
  const q={
    select(){return q;},
    eq(k,v){values=values.filter(x=>x[k]===v);return q;},
    in(k,vs){values=values.filter(x=>vs.includes(x[k]));return q;},
    order(k,{ascending}={}){values=values.slice().sort((a,b)=>ascending?String(a[k]).localeCompare(String(b[k])):String(b[k]).localeCompare(String(a[k])));return q;},
    limit(n){values=values.slice(0,n);return q;},
    async maybeSingle(){return {data:values[0]??null,error:null};},
    then(done,reject){return Promise.resolve({data:values,error:null}).then(done,reject);}
  };
  return q;
}
const db={from:query};
const exports={};
const source=fs.readFileSync("src/lib/kshc-access.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(js,{
  exports,console,
  process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://example.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-only"}},
  require(name){
    if(name==="next/headers")return {cookies:async()=>({get:()=>null})};
    if(name==="@/lib/khpos/auth")return {bearerTokenFromRequest:()=>null,verifyKhposAccessToken:async()=>null};
    if(name==="@/lib/storage")return {getAssessmentState:async(id)=>({school:{email:id===reportUnlinked?"free-owner@example.com":"teacher@example.com"}})};
    if(name==="@supabase/supabase-js")return {createClient:()=>db};
    throw Error("Unexpected import "+name);
  }
});
const {canAccessKshcReport,canViewKshcLinkedSchoolReport,filterKshcOwnedAssessments,listKshcLeadershipReports}=exports;
const user=(id,email="teacher@example.com")=>({id,email,aal:"aal1",provider:"email"});
const partner=(id=org)=>({organisationId:id,name:id===org?"Test School":"Other School",partnerStatus:"active",membershipStatus:"active",membershipRole:"contributor"});
let checks=0;
async function check(result,expected,reason){assert.equal(await result,expected,reason);checks++;}
await check(canAccessKshcReport(reportLinked,user(userTeacher)),false,"Original email owner who is teacher-only must be denied");
await check(canAccessKshcReport(reportLinked,user(userCustodian)),true,"School Custodian permitted");
await check(canAccessKshcReport(reportLinked,user(userGuardian)),true,"School Guardian permitted");
await check(canAccessKshcReport(reportLinked,user(userAcademic)),true,"Academic Inspector permitted");
await check(canAccessKshcReport(reportLinked,user(userSkills)),true,"Skill Inspector permitted");
await check(canAccessKshcReport(reportLinked,user(userPromoterTeacher)),true,"Teacher with active Sectional Promoter position permitted");
await check(canAccessKshcReport(reportLinked,user(userWrongSchool)),false,"Other school's leadership role cannot read this school");
await check(canAccessKshcReport(reportLinked,user(userExpired)),false,"Expired leadership appointment cannot read report");
await check(canAccessKshcReport(reportLinked,user(userUnauthorised)),false,"No membership denied");
await check(canAccessKshcReport(reportSuspended,user(userCustodian)),false,"Suspended school denied");
await check(canAccessKshcReport(reportUnlinked,user(userTeacher)),false,"Unlinked report not accessible by unrelated account");
await check(canAccessKshcReport(reportUnlinked,user(userTeacher,"free-owner@example.com")),true,"Standalone free report remains accessible to verified creator");
await check(canViewKshcLinkedSchoolReport(otherOrg,userWrongSchool),true,"School leader can read only own school");
await check(canViewKshcLinkedSchoolReport(otherOrg,userTeacher),false,"Other-school teacher denied");

const owned=[
 {id:reportLinked,schoolName:"Test",completed:true,createdAt:"2026-10-01"},
 {id:reportUnlinked,schoolName:"Standalone",completed:true,createdAt:"2026-10-02"},
 {id:"00000000-0000-0000-0000-000000000109",schoolName:"Unfinished",completed:false,createdAt:"2026-10-03"},
];
const teacherVisible=await filterKshcOwnedAssessments(userTeacher,[partner()],owned);
assert.equal(teacherVisible.some(x=>x.id===reportLinked),false,"Restricted report should not be listed in teacher account");checks++;
assert.equal(teacherVisible.some(x=>x.id===reportUnlinked),true,"Standalone free KSHC remains listed");checks++;
assert.equal(teacherVisible.some(x=>!x.completed),true,"Unfinished assessments remain available");checks++;
const leaderVisible=await filterKshcOwnedAssessments(userPromoterTeacher,[partner()],owned);
assert.equal(leaderVisible.some(x=>x.id===reportLinked),true,"Dual-position leader sees own school report");checks++;

const teacherReports=await listKshcLeadershipReports(userTeacher,[partner()]);
assert.equal(teacherReports.length,0,"Teacher-only must not receive shared school reports");checks++;
const leaderReports=await listKshcLeadershipReports(userPromoterTeacher,[partner()]);
assert.equal(leaderReports.length,1,"Appointed leader should see school's completed report");checks++;

const reportRoutes=[
 "src/app/report/[id]/page.tsx",
 "src/app/report/[id]/layout.tsx",
 "src/app/api/report/[id]/pdf/route.ts",
 "src/app/api/report/[id]/coach/route.ts",
];
for(const file of reportRoutes){
  assert.match(fs.readFileSync(file,"utf8"),/canAccessKshcReport\(id, user\)/,"Page, layout, PDF and coach must enforce access: "+file);checks++;
}
const workspace=fs.readFileSync("src/lib/khpos/workspace.ts","utf8");
assert.match(workspace,/canViewKshcLinkedSchoolReport\(organisationId, userId\)/);
assert.match(workspace,/const assessments = canViewHealthReport \?/);
assert.match(workspace,/canViewHealthReport,/);
checks+=3;
const account=fs.readFileSync("src/app/api/account/route.ts","utf8");
assert.match(account,/filterKshcOwnedAssessments\(user.id, partnerships, assessments\)/);checks++;
const command=fs.readFileSync("src/components/khpos/CommandCentre.tsx","utf8");
assert.match(command,/workspace.canViewHealthReport && <div[^>]+>[\s\S]*?View full KSHC report/);
assert.match(command,/workspace.canViewHealthReport && <section className="grid gap-6/);
checks+=2;
const pdf=fs.readFileSync("src/app/api/report/[id]/pdf/route.ts","utf8");
assert.match(pdf,/Cache-Control": "private, no-store"/);checks++;

console.log("KSHC report leadership-only access: "+checks+" checks passed.");
