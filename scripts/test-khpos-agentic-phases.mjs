import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read=(p)=>fs.readFileSync(p,"utf8");
const compiled=ts.transpileModule(read("src/lib/khpos/agentic/plan.ts"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const funcs={};
vm.runInNewContext(compiled,{exports:funcs});
const org="80c22121-f3bb-4f5d-8d88-87d7c996421d";
const now="2026-11-08T09:00:00.000Z";
const attention={
 generatedAt:now,
 summary:{actionRequired:2,critical:1,overdue:1,blocked:1,awaitingVerification:1,waitingApproval:0,issues:0},
 items:[
  {id:"work:11111111-1111-4111-8111-111111111111",kind:"work",severity:"critical",
   title:"Timetable coverage blocked",detail:"A lesson has no confirmed substitute.",
   href:"/khpos/"+org+"/work",dueAt:now,actionLabel:"Resolve blocker"},
  {id:"verification:22222222-2222-4222-8222-222222222222",kind:"verification",
   severity:"medium",title:"Weekly report submitted",detail:"Needs independent review",
   href:"/khpos/"+org+"/work",dueAt:null,actionLabel:"Verify"},
 ],
};
const metric=(percent)=>({percent});
const performance={
 periodDays:30,
 executionCoverage:metric(100),
 workCompletionReliability:metric(45),
 onTimeCompletion:metric(null),
 verificationFirstPass:metric(79),
 issueClosure:metric(95),
 decisionActionClosure:metric(100),
 recordsSubmitted:7,
};
const health={
 baseline:{assessmentId:"id",completedAt:now,overallScore:68,healthRating:"Progressing",frameworkVersion:"1.0"},
 latest:{reassessmentOverallScore:62,deltaFromBaseline:-6,verifiedImprovement:false},
 priorityOutcomes:[
  {priorityId:"priority-1",sourceIndicatorId:"ACD-001",outcome:"regressed",scoreDelta:-1},
  {priorityId:"priority-2",sourceIndicatorId:"OPS-002",outcome:"resolved",scoreDelta:2},
 ],
};
const r=funcs.buildSchoolAgentPlan({organisationId:org,attention,performance,health,generatedAt:now});
assert.equal(r.modelTokensUsed,0);
assert.equal(r.operatingRule,"review_before_action");
assert.equal(r.summary.critical,1);
assert(r.actions.some(x=>x.id==="performance:workCompletionReliability"));
assert(!r.actions.some(x=>x.id==="performance:onTimeCompletion"),"Missing data must not be treated as failure");
assert(r.actions.some(x=>x.id==="kshc:priority:priority-1"));
assert(!r.actions.some(x=>x.id==="kshc:priority:priority-2"),"Resolved KSHC findings stay resolved");
const first=r.actions.find(x=>x.id==="attention:"+attention.items[0].id);
assert.equal(first.decisionDraft.priority,"P1");
assert.match(first.decisionDraft.context,/not an approval/);
assert.equal(r.actions.find(x=>x.id==="attention:"+attention.items[1].id).decisionDraft,null);
assert(r.actions.every(x=>x.href.startsWith("/khpos/"+org+"/")));
assert.equal(r.summary.approvalCandidates,1);
const missing=funcs.buildSchoolAgentPlan({organisationId:org,attention:{...attention,items:[]},
 performance,health:{baseline:null,latest:null,priorityOutcomes:[]}});
assert(missing.actions.some(x=>x.id==="kshc:baseline"));
const offline=funcs.buildSchoolAgentPlan({organisationId:org,attention:{...attention,items:[]},
 performance,health:null});
assert(!offline.actions.some(x=>x.id==="kshc:baseline"),"KSHC outage is not lack of baseline");

const ksi={
 integration:{status:"active"},
 latest:{sourceGeneratedAt:now},
 signals:[
  {key:"hqls_fidelity",title:"HQLS fidelity",state:"attention",
   headline:"Review delivery fidelity",detail:"School aggregate only."},
  {key:"assessment_alignment",title:"Assessment alignment",state:"insufficient",
   headline:"Not enough verified assessments",detail:"Small sample."},
  {key:"diagnosis_governance",title:"Diagnosis governance",state:"strong",
   headline:"Good evidence",detail:"Aggregate quality."},
 ],
};
const integrated=funcs.buildSchoolAgentPlan({
 organisationId:org,attention:{...attention,items:[]},performance,health,ksi,generatedAt:now,
});
assert.equal(integrated.modelTokensUsed,0);
assert.equal(integrated.summary.ksiAvailable,true);
assert(integrated.actions.some(x=>x.id==="ksi:hqls_fidelity"));
assert(integrated.actions.some(x=>x.id==="ksi:assessment_alignment"));
assert(!integrated.actions.some(x=>x.id==="ksi:diagnosis_governance"));
assert(integrated.actions.filter(x=>x.source==="ksi").every(x=>
 x.href==="/khpos/"+org+"/learning-intelligence"));
const notLinked=funcs.buildSchoolAgentPlan({
 organisationId:org,attention:{...attention,items:[]},performance,ksi:{
  integration:{status:"not_connected"},latest:null,signals:[...ksi.signals],
 },
});
assert(!notLinked.actions.some(x=>x.source==="ksi"),"Optional disconnected KSI should not be treated as a failure");

const portfolio={
 generatedAt:now,
 institutions:[
  {organisationId:"school-a",name:"School A",attention:"monitor"},
  {organisationId:"school-b",name:"School B",attention:"regression"},
  {organisationId:"school-c",name:"School C",attention:"baseline_required"},
 ],
 observability:{institutions:[
  {organisationId:"school-a",standardStatus:"current",failedTriggers7d:0,overdueWork:0,staleVerification:0,p0Unmapped:0},
  {organisationId:"school-b",standardStatus:"missing",failedTriggers7d:3,overdueWork:2,staleVerification:1,p0Unmapped:2},
  {organisationId:"school-c",standardStatus:"current",failedTriggers7d:0,overdueWork:0,staleVerification:0,p0Unmapped:0},
 ]},
};
const network=funcs.buildNetworkAgentPlan(portfolio);
assert.equal(network.modelTokensUsed,0);
assert.equal(network.summary.schoolsScanned,3);
assert.equal(network.summary.critical,1);
assert.equal(network.summary.needsHumanReview,2);
assert.equal(network.actions[0].schoolName,"School B");
assert.equal(network.actions.length,2);
assert(network.actions.every(x=>x.href==="/khpos/portfolio#portfolio-institutions"));
assert(!JSON.stringify(network).includes("learner_id"));
const server=read("src/lib/khpos/ops/briefing.ts");
const api=read("src/app/api/khpos/portfolio/route.ts");
const decisions=read("src/components/khpos/ops/DecisionsWorkspace.tsx");
const lead=read("src/components/khpos/ops/LeadershipBriefWorkspace.tsx");
const ui=read("src/components/khpos/PortfolioIntelligenceWorkspace.tsx");
assert(server.includes("buildSchoolAgentPlan")&&server.includes("getKhposImprovementWorkspace")&&server.includes("getKhposKsiWorkspace"));
assert(api.indexOf("getKhposPortfolioIntelligence(user.id)")<api.indexOf("buildNetworkAgentPlan(portfolio)"));
assert(decisions.includes("payload.brief?.agentPlan?.actions.find("));
assert(decisions.includes('setDecisionMode("request")'));
assert(decisions.includes("setShowCreate(true)"));
assert(lead.includes("Prepare decision request"));
assert(lead.includes("agentPlan.actions"));
assert(ui.includes("agentPlan.actions"));
assert(!read("src/lib/khpos/agentic/plan.ts").includes("chat.completions"));
console.log("Four-phase pilot verified: scoped signals, review-only action drafts, honest KSHC evidence, restricted network priorities and zero model calls.");
