import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read=(p)=>fs.readFileSync(p,"utf8");
function compile(path,imports={}){
  const exports={};
  const code=ts.transpileModule(read(path),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code,{exports,require:(key)=>{
    if(Object.hasOwn(imports,key))return imports[key];
    throw new Error("Unexpected import "+key);
  }},{filename:path});
  return exports;
}
const academy=compile("src/lib/khpos/academy-data.ts");
const help=compile("src/lib/khpos/ops/app-help.ts");
const org="a25c6438-c32f-4ccb-9374-5ddcc0e16485";
const staff=academy.academyForSchoolRole(["TEACHER"],"staff");
const leaders=academy.academyForSchoolRole(["TEACHER"],"school_guardian");
assert.deepEqual(Array.from(staff,c=>c.id),["staff"],"Staff must not see leadership or HQ guides");
assert.deepEqual(Array.from(leaders,c=>c.id),["staff","leadership"]);
assert.deepEqual(Array.from(academy.academyForRole([],true),c=>c.id),["staff","leadership","hq"]);

for(const q of [
  "How do I check in for a class?",
  "How do I create a timetable?",
  "Where can I find school attendance records?",
  "How can I use the app?",
  "Show me the training academy",
  "How do I request leave?",
]) assert.equal(help.isKhposAppHelpQuestion(q),true,q);
for(const q of [
  "What needs my attention today?",
  "Which decisions are waiting for action?",
  "What is our process for missed lessons?",
  "How should we improve school results?",
  "Tell me the performance trends",
]) assert.equal(help.isKhposAppHelpQuestion(q),false,q);

function first(q,courses=leaders){
  return help.answerKhposAppHelp(q,courses,org).matches[0];
}
assert.equal(first("How do I check in for a class?",staff)?.lesson.title,
  "Class timetable and lesson attendance");
assert.equal(first("How do I create a timetable?")?.lesson.title,
  "Teaching plans and class assignments");
assert.equal(first("Where can I find school attendance records?")?.lesson.title,
  "Attendance leadership overview");
assert.equal(first("How can I find the Training Academy?",staff)?.lesson.title,
  "Ask KHP-OS and find approved guides");
assert.equal(first("How do I check in to my school?",staff)?.lesson.title,
  "School check-in and check-out");

const staffResponse=help.answerKhposAppHelp("How do I create a timetable?",staff,org);
assert(staffResponse.matches.every(m=>m.courseId==="staff"),"Staff should not receive leader procedures");
assert(staffResponse.matches.every(m=>!m.href.includes("/hq")),"School help cannot link corporate pages");
const route=first("How do I check in for a class?",staff).href;
assert.equal(route,`/khpos/${org}/teaching-presence`);
const response=help.answerKhposAppHelp("How do I check in for a class?",staff,org);
assert.match(response.answer,/1\./);
assert.match(response.answer,/approved school role/);
assert.match(response.answer,/class/i);
const noMatch=help.answerKhposAppHelp("Where is the one click moon base?",staff,org);
assert.equal(noMatch.matches.length,0,"Unknown screens must not be fabricated");
assert.match(noMatch.answer,/Tell me the feature/);

const assistant=read("src/lib/khpos/ops/assistant.ts");
const branch=assistant.indexOf('if (intent === "app_help")');
const ai=assistant.indexOf("const permit = ai && groundedContext");
assert(branch>0&&ai>branch,"Help requests must return before any paid-model reservation");
assert(assistant.includes('return "app_help"'));
assert(assistant.includes('tokenFree: true'));
assert(assistant.includes("academyForSchoolRole"));
assert(assistant.includes("getKhposOpsLibrary(organisationId, userId)"));
const ui=read("src/components/khpos/ops/AskKhposWorkspace.tsx");
assert.match(ui,/Training guide · No AI tokens/);
assert.match(ui,/Open the Training Academy/);
console.log("Ask KHP-OS: cost-free application help, role-based lessons, source routes, and non-help routing passed.");
