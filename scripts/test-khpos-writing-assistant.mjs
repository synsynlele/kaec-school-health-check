import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
const compiled=ts.transpileModule(read("src/lib/khpos/writing-assistant.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const out={};
vm.runInNewContext(compiled,{exports:out});
const input={
 title:"Staff Development Workshop",
 purpose:"A staff workshop will take place to review safeguarding protocols.",
 keyPoints:"Meet in the conference room.\nBring your current staff handbook.",
 requiredAction:"Confirm attendance with the School Guardian.",
 deadline:"13 November at 9:00 am",
 closingName:"School Leadership",
 tone:"formal",
};
const notice=out.composeAnnouncement(input);
for(const text of ["Dear colleagues","safeguarding protocols","conference room",
 "13 November at 9:00 am","School Leadership","Confirm attendance"])assert(notice.includes(text),text);
assert(!notice.includes("mandatory"),"Do not invent mandatory attendance");
assert(!notice.includes("approved by"),"Do not imply an approval");
for(const tone of ["warm","concise"]){
 const variant=out.composeAnnouncement({...input,tone});
 assert(variant.includes("safeguarding protocols"));
 assert(variant.includes("13 November at 9:00 am"));
}
const noDate=out.composeAnnouncement({...input,deadline:"",contact:""});
assert(!noDate.includes("Deadline / schedule"),"Do not invent dates");
assert.throws(()=>out.composeAnnouncement({...input,purpose:""}),/Describe the announcement/);
const school=out.composeSchoolReport({
 title:"Teaching and Learning Update",author:"Sample Teacher",
 periodStart:"1 Nov 2026",periodEnd:"5 Nov 2026",
 fields:[
  {key:"lessons",label:"Were your scheduled lessons held?",type:"select"},
  {key:"learning",label:"Were the learning targets achieved?",type:"select"},
  {key:"support_needed",label:"Do learners need further support?",type:"boolean"},
  {key:"next_action",label:"What happens next?",type:"textarea"},
  {key:"evidenceLink",label:"Supporting document",type:"url"},
  {key:"hidden_private",label:"Hidden case note",type:"textarea"},
 ],
 payload:{
  lessons:"Some held",learning:"Partly achieved",support_needed:false,
  next_action:"Revisit difficult examples on Monday.",
  evidenceLink:"https://example.org/evidence",
 },
});
assert(school.includes("Sample Teacher"));
assert(school.includes("Some held"));
assert(school.includes("Partly achieved"));
assert(school.includes("Do learners need further support?: No"));
assert(school.includes("Revisit difficult examples"));
assert(school.includes("https://example.org/evidence"));
assert(!school.includes("Hidden case note"),"Only entered visible source fields should be shown");
assert(/does not independently verify outcomes/.test(school));
assert.throws(()=>out.composeSchoolReport({title:"Empty",fields:[],payload:{}}),/at least one report answer/);
const hq=out.composeHqReport({
 title:"Monthly Pathfinder Update",periodLabel:"November, Week 2",
 progress:"Partly completed",areas:["School follow-up"],
 achievements:"Visited the partner school and reviewed the teaching log.",
 challenges:"Timetable records were incomplete.",
 nextActions:"Academic leader to verify class allocation on 12 November.",
 evidence:"Signed visit log",
});
assert(hq.includes("Visited the partner school"));
assert(hq.includes("Partly completed"));
assert(hq.includes("Timetable records were incomplete"));
assert(hq.includes("Signed visit log"));
assert(hq.includes("Reporter-supplied"));
assert(!hq.includes("All goals achieved"),"Do not fabricate attainment");
assert.throws(()=>out.composeHqReport({title:"Empty",periodLabel:"November"}),/Record the work completed/);
for(const file of [
 "src/components/khpos/AnnouncementsWorkspace.tsx",
 "src/components/khpos/ReportsWorkspace.tsx",
 "src/components/khpos/CorporateReportingCentre.tsx",
]){
 const code=read(file);
 assert(code.includes("writing-assistant"),file+" requires the shared composer");
 assert(/No AI tokens/.test(code),file+" must label cost");
 assert(/Professional/.test(code),file+" needs a professional writer entry");
}
const an=read("src/components/khpos/AnnouncementsWorkspace.tsx");
assert(an.includes('setAnnouncementMessage(composeAnnouncement('));
assert(an.includes('name="message"'),"Keep existing governed publishing payload");
assert(an.includes('name="mode" value="publish"'),"Publishing remains separate and explicit");
const rep=read("src/components/khpos/ReportsWorkspace.tsx");
assert(rep.includes('composeSchoolReport('));
assert(rep.includes('visibleReportPayload(n.fields, payload)'),"Use only authorised form data");
assert(rep.includes('act("submit")'),"Report submission remains explicit");
const hqUi=read("src/components/khpos/CorporateReportingCentre.tsx");
assert(hqUi.includes('composeHqReport('));
assert(hqUi.includes('act("submit_report"'),"HQ report submission remains explicit");
assert(!read("src/lib/khpos/writing-assistant.ts").includes("fetch("),"Writer must not call external services");
assert(!read("src/lib/khpos/writing-assistant.ts").includes("chat.completions"),"Writer must be zero-token");
console.log("KHP-OS local writing: reports, HQ narratives, announcements, fact preservation, no automatic publication and zero model calls verified.");
