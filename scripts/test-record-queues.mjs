import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const base="src/components/khpos/ops/";
const modules=[
 ["IssuesWorkspace","issueQueue","status === \"closed\""],
 ["DecisionsWorkspace","decisionQueue","status === \"closed\""],
 ["ParentPartnershipWorkspace","caseQueue","status === \"closed\""],
 ["AssetsMaintenanceWorkspace","assetQueue","status === \"retired\""],
 ["StudentCultureWorkspace","cultureQueue","\"closed\""],
 ["SafeguardingWorkspace","safeguardingQueue","status === \"closed\""],
 ["ExtendedWorkspace","eventQueue","\"reviewed\""],
 ["ExtendedWorkspace","journeyQueue","\"completed\""],
 ["AvailabilityWorkspace","availabilityQueue","\"closed\""],
 ["RecruitmentWorkspace","workforceQueue","\"filled\""],
 ["RecruitmentWorkspace","vacancyQueue","\"filled\""],
 ["RecruitmentWorkspace","applicationsQueue","\"appointed\""],
 ["PeopleWorkspace","staffQueue","status === \"ended\""],
 ["StaffAccountabilityWorkspace","accountabilityQueue","\"closed\""],
 ["StaffPerformanceWorkspace","reviewQueue","\"completed\""],
 ["StaffTransitionWorkspace","successionQueue","\"archived\""],
 ["StaffTransitionWorkspace","promotionQueue","\"executed\""],
 ["StaffTransitionWorkspace","exitQueue","\"closed\""],
 ["LearnerProgressWorkspace","signalQueue","\"resolved\""],
 ["LearnerProgressWorkspace","learnerCaseQueue","\"closed\""],
];
let count=0;
const queue=read(base+"RecordQueue.tsx");
assert.ok(queue.includes('useState<RecordQueueView>("active")'));
assert.ok(queue.includes("historicalIds")&&queue.includes('window.addEventListener("hashchange"'));
assert.ok(queue.includes('aria-pressed={view === mode}'));
count+=3;
for(const [file,id,condition] of modules){
 const s=read(base+file+".tsx");
 assert.ok(s.includes("const "+id+" = useRecordQueue("),file+" missing queue");
 assert.ok(s.includes(condition),file+" missing terminal state");
 assert.ok(s.includes("<RecordQueueTabs view={"+id+".view}"),file+" missing toggle");
 assert.ok(s.includes(id+".visibleItems"),file+" still shows all records");
 count+=4;
}
const today=read(base+"MyWorkWorkspace.tsx");
assert.ok(today.includes("<details className=")&&today.includes("History · {completedItems.length}"));
assert.ok(!today.includes("completedItems.slice(0, 10)"));
count+=2;
const account=read("src/components/account/AccountAccess.tsx");
const privacy=read("src/app/privacy/page.tsx");
const deletion=read("src/app/delete-account/page.tsx");
const form=read("src/components/account/DeleteAccountRequestForm.tsx");
assert.ok(account.includes('href="/delete-account"'));
assert.ok(deletion.includes("KHP-OS by KAEC-NG")&&deletion.includes("DeleteAccountRequestForm"));
assert.ok(form.includes('fetch("/api/contact"')&&form.includes("ACCOUNT & PERSONAL DATA DELETION REQUEST"));
assert.ok(privacy.includes("safeguarding reports")&&privacy.includes('href="/delete-account"'));
assert.ok(!privacy.includes("no student data — ever"));
count+=5;
console.log("Active / History & Play Store privacy regression: "+count+" checks passed.");
