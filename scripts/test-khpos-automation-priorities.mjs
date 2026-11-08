import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=(path)=>fs.readFileSync(path,"utf8");
function load(path){
 const exports={};const js=ts.transpileModule(source(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports},{filename:path});return exports;
}
const prefill=load("src/lib/khpos/report-prefill.ts");
const meetings=load("src/lib/khpos/ops/meeting-followups.ts");
const schedule=load("src/lib/khpos/ops/schedule-assist.ts");
const writer=load("src/lib/khpos/writing-assistant.ts");
const org="22222222-2222-4222-8222-222222222222";
const report={period_start:"2026-11-02",period_end:"2026-11-08",
 fields:[{key:"notes",label:"Additional notes",type:"textarea",required:false},
 {key:"lessons",label:"Were lessons held?",type:"select",required:true,options:["All held","Some held","None held"]}],
 payload:{lessons:"Some held"}};
const records={from:"2026-11-02",to:"2026-11-08",records:[
 {periodId:"x",date:"2026-11-03",in:"now",out:"later",outcome:"completed",administrativelyClosed:false},
 {periodId:"y",date:"2026-11-04",in:"now",out:null,outcome:null,administrativelyClosed:false},
 {periodId:"z",date:"2026-10-30",in:"then",out:"then",outcome:"completed",administrativelyClosed:false},
]};
const evidence=prefill.buildEvidencePrefill(report,records,org);
assert.equal(evidence.recordCount,2);
assert.equal(evidence.suggested.length,1);
assert.equal(evidence.suggested[0].key,"notes");
assert(evidence.suggested[0].value.includes("Recorded class-session check-ins"));
assert(evidence.suggested[0].value.includes("not a count of every timetabled lesson"));
assert(!evidence.suggested.some(x=>x.key==="lessons"),"Never auto-mark all/some lessons held");
assert(evidence.sourceHref.includes(org));
const none=prefill.buildEvidencePrefill({...report,period_start:"2026-10-01",period_end:"2026-10-06"},records,org);
assert.equal(none.recordCount,0);
assert.equal(none.suggested.length,0);
const filled=prefill.buildEvidencePrefill({...report,payload:{notes:"Existing teacher wording"}},records,org);
assert.equal(filled.suggested.length,0,"Never overwrite an existing report answer");

const follow=meetings.deriveMeetingFollowUps({
 decisions:[{id:"d1",body:"Action: Confirm the timetable coverage\nDiscuss teacher workloads"}],
 messages:[{id:"m1",body:"Task: Verify end-of-week reporting."},
 {id:"m2",body:"This is an ordinary chat message."},
 {id:"m3",body:"Follow-up: Confirm the timetable coverage"}],
 existingActions:[{title:"Verify end-of-week reporting"}],
});
assert.equal(follow.length,1);
assert(follow[0].title.includes("timetable coverage"));
assert.equal(meetings.deriveMeetingFollowUps({decisions:[],messages:[{id:"m",body:"We should think about attendance."}],existingActions:[]}).length,0);

const periods=[
 {id:"one",weekday:1,start:"08:00",end:"09:30",termActive:true,campusId:"campus-1",teacherUserId:"t1",class:"JSS1",subject:"English",room:"A"},
 {id:"two",weekday:1,start:"09:00",end:"10:30",termActive:true,campusId:"campus-1",teacherUserId:"t1",class:"JSS2",subject:"Maths",room:"B"},
 {id:"three",weekday:2,start:"08:00",end:"09:30",termActive:true,campusId:"campus-1",teacherUserId:"t1",class:"JSS3",subject:"Science",room:"C"},
 {id:"four",weekday:1,start:"08:00",end:"09:30",termActive:false,campusId:"campus-1",teacherUserId:"t1",class:"SSS1",subject:"Biology",room:"D"},
];
const collisions=schedule.findScheduleCollisions(periods);
assert.equal(collisions.length,1);assert.equal(collisions[0].kind,"teacher");
const exams=schedule.findExamCollisions([
 {id:"exam1",title:"English",class_label:"JSS1",starts_at:"2026-11-09T08:00:00+01:00",ends_at:"2026-11-09T09:00:00+01:00",invigilators:["a"]},
 {id:"exam2",title:"Maths",class_label:"JSS2",starts_at:"2026-11-09T08:30:00+01:00",ends_at:"2026-11-09T10:00:00+01:00",invigilators:["a"]},
 {id:"exam3",title:"Science",class_label:"JSS3",starts_at:"2026-11-09T11:30:00+01:00",ends_at:"2026-11-09T12:30:00+01:00",invigilators:["a"]},
]);assert.equal(exams.length,1);assert(exams[0].reason.includes("invigilator"));
const availabilityCase={id:"leave1",staffId:"a",campusName:"A",roleTitle:"Teacher",coverageRequired:true,coverageConfirmed:false,status:"coverage_required",startAt:"2026-11-09T07:00:00Z",endAt:"2026-11-09T15:00:00Z"};
const options=schedule.proposeCoverageCandidates(availabilityCase,{
 cases:[availabilityCase,{id:"leave2",staffId:"b",status:"approved",startAt:"2026-11-09T06:00:00Z",endAt:"2026-11-09T16:00:00Z"}],
 coverageCandidates:[{staffId:"b",displayName:"Absent",campusName:"A",roleTitle:"Teacher"},
  {staffId:"c",displayName:"Qualified to check",campusName:"A",roleTitle:"Teacher"},
  {staffId:"d",displayName:"Other campus",campusName:"B",roleTitle:"Teacher"}],
});
assert.equal(options[0].staffId,"c");
assert(!options.some(x=>x.staffId==="b"),"Never suggest known unavailable staff");
const progress={workCompleted:3,issuesResolved:2,decisionsImplemented:1,recordsSubmitted:5};
const brief=writer.composeLeadershipSummary({organisationName:"KAEC Nigerian Schools",
 generatedAt:"2026-11-08T10:00:00Z",periodDays:30,progress,
 attention:{summary:{critical:1,overdue:2,blocked:1,waitingApproval:3}},
 agentPlan:{actions:[{title:"Blocked lesson",recommendation:"Confirm substitute",priority:"high",source:"attention"}]}});
assert(brief.includes("previous 30 days"));assert(brief.includes("Work completed")===false);
assert(brief.includes("Completed work items: 3"));
assert(brief.includes("Confirm substitute"));
const digest=writer.composeNetworkSupportDigest({generatedAt:"2026-11-08T10:00:00Z",
 summary:{schoolsScanned:2,needsHumanReview:1,critical:1},
 actions:[{schoolName:"School One",priority:"critical",reasons:["Critical delivery gap"],proposedNextStep:"Assign authorised Pathfinder follow-up"}]});
assert(digest.includes("School One"));
assert(digest.includes("Confidential: KAEC platform custodians only"));
assert(!source("src/lib/khpos/ops/schedule-assist.ts").includes("fetch("));
assert(source("src/app/api/khpos/reports/prefill/route.ts").includes("r.isMine && r.canEdit"));
assert(source("src/app/api/khpos/reports/prefill/route.ts").includes("getOwnClassRecordsForReport(school,actor.id,report.period_start,report.period_end)"));
const ownerQuery=source("src/lib/khpos/ops/presence.ts");
assert(ownerQuery.includes('.eq("teacher_user_id",actor)'));
assert(ownerQuery.includes('p.teacherUserId===actor'));
assert(ownerQuery.includes('210*86_400_000'));
assert(source("src/components/khpos/ReportsWorkspace.tsx").includes("applyVerifiedEvidence"));
assert(source("src/components/khpos/ops/MeetingsWorkspace.tsx").includes("setOwner(\"\");setDue(\"\")"));
assert(source("src/components/khpos/ops/TeacherPresenceWorkspace.tsx").includes("findScheduleCollisions"));
assert(source("src/components/khpos/ops/AvailabilityWorkspace.tsx").includes("proposeCoverageCandidates"));
assert(source("src/components/khpos/ops/AssessmentTimetable.tsx").includes("findExamCollisions"));
assert(source("src/components/khpos/PortfolioIntelligenceWorkspace.tsx").includes("composeNetworkSupportDigest"));
const briefSource=source("src/app/api/khpos/ops/briefing/[id]/route.ts");
assert(briefSource.includes('windowParam === "30"'));
console.log("Five automation priorities: authorised evidence prefill, leadership reports, meeting drafts, safe coverage, timetable collisions and HQ digests passed.");
