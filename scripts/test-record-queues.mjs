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
const findSort=read(base+"RecordQueueSearch.tsx");
assert.ok(findSort.includes("terms.every")&&findSort.includes("items.filter"));
assert.ok(findSort.includes('sort !== "original"')&&findSort.includes('role="search"'));
assert.ok(findSort.includes('aria-live="polite"'));
count+=3;
for(const [page, queue, filtered] of [
  ["IssuesWorkspace","issueQueue","issueSearch"],
  ["DecisionsWorkspace","decisionQueue","decisionSearch"],
  ["PeopleWorkspace","staffQueue","staffSearch"],
  ["ParentPartnershipWorkspace","caseQueue","caseSearch"],
  ["AssetsMaintenanceWorkspace","assetQueue","assetSearch"],
]){
  const source=read(base+page+".tsx");
  assert.ok(source.includes("const "+filtered+" = useRecordSearch("),page+" missing hook");
  assert.ok(source.includes("useRecordSearch(\n    "+queue+".visibleItems"),page+" must preserve queue lifecycle filter");
  assert.ok(source.includes("<RecordQueueSearchControls query={"+filtered+".query}"),page+" missing toolbar");
  assert.ok(source.includes(filtered+".visibleItems.map("),page+" still renders unsorted/unfiltered items");
  assert.ok(source.includes("No "+(page==="PeopleWorkspace"?"staff":page==="AssetsMaintenanceWorkspace"?"assets":"")),page+" missing empty state");
  count+=5;
}
for(const page of ["InstitutionalLibrary","OperationalRecordsWorkspace"]){
  const source=read(base+page+".tsx");
  assert.ok(source.includes("setSortOrder"),page+" missing sort control");
  assert.ok(source.includes("sortOrder !== \"default\""),page+" missing sort comparator");
  count+=2;
}

const expandedQueues = {
  AvailabilityWorkspace: ["availabilitySearch"],
  LearnerProgressWorkspace: ["signalSearch", "learnerCaseSearch"],
  RecruitmentWorkspace: ["workforceSearch", "vacancySearch", "applicationsSearch"],
  StaffAccountabilityWorkspace: ["accountabilitySearch"],
  StaffPerformanceWorkspace: ["reviewSearch"],
  StaffTransitionWorkspace: ["successionSearch", "promotionSearch", "exitSearch"],
  ExtendedWorkspace: ["eventSearch", "journeySearch"],
  StudentCultureWorkspace: ["cultureSearch"],
};
for (const [page, searches] of Object.entries(expandedQueues)) {
  const source = read(base+page+".tsx");
  for (const search of searches) {
    assert.ok(source.includes("const "+search+" = useRecordSearch("),page+" missing "+search);
    assert.ok(source.includes("<RecordQueueSearchControls query={"+search+".query}"),page+" toolbar missing "+search);
    assert.ok(source.includes(search+".visibleItems.map("),page+" does not render filtered "+search);
    count += 3;
  }
}
const calendar = read(base+"InstitutionalCalendarWorkspace.tsx");
assert.ok(calendar.includes("const calendarSearch = useRecordSearch("));
assert.ok(calendar.includes("calendarSearch.visibleItems.filter("));
assert.ok(calendar.includes("<RecordQueueSearchControls query={calendarSearch.query}"));
count += 3;
const attendance = read(base+"TeacherPresenceWorkspace.tsx");
assert.ok(attendance.includes("School check-in and check-out"));
assert.ok(attendance.includes("Class lesson check-in and check-out"));
assert.ok(attendance.includes("School check-in recorded")&&attendance.includes("Class check-in recorded"));
assert.ok(attendance.includes("dateTime(d.in)")&&attendance.includes("dateTime(p.session!.in)"));
assert.ok(attendance.includes("dateTime(d.out)")&&attendance.includes("dateTime(p.session!.out)"));
count += 5;

const today=read(base+"MyWorkWorkspace.tsx");
assert.ok(today.includes("const workSearch = useRecordSearch("));
assert.ok(today.includes("<RecordQueueSearchControls")&&today.includes("verificationItems.map("));
assert.ok(today.includes("availableProcesses.map(")&&today.includes("workSearch.visibleItems"));
count += 3;
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
