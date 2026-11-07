import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const src=(p)=>fs.readFileSync(p,"utf8");
const data=src("src/lib/khpos/academy-data.ts");
const api=src("src/app/api/khpos/academy/route.ts");
const ask=src("src/components/khpos/ops/AskKhposWorkspace.tsx");
const ui=src("src/components/khpos/ops/TrainingAcademy.tsx");
const hq=src("src/components/khpos/KaecHqWorkspace.tsx");
const out=src("src/lib/khpos/academy-documents.ts");
for(const [name,body,kind] of [["curriculum",data,ts.ScriptKind.TS],["api",api,ts.ScriptKind.TS],["ui",ui,ts.ScriptKind.TSX],["ask",ask,ts.ScriptKind.TSX],["documents",out,ts.ScriptKind.TS]]){
  const f=ts.createSourceFile(name,body,ts.ScriptTarget.Latest,true,kind);
  assert.equal(f.parseDiagnostics.length,0,name+" should parse");
}
assert.match(data,/id:"staff"/);
assert.match(data,/id:"leadership"/);
assert.match(data,/id:"hq"/);
assert.match(data,/if\(corporate\)/);
assert.match(data,/course\.id==="leadership"&&leadership/);
assert.match(api,/verifyKhposAccessToken\(token\)/);
assert.match(api,/getKhposOpsLibrary\(organisationId,user\.id\)/);
assert.match(api,/getHqSnapshot\(user\)/);
assert.match(api,/courses\.find\(c=>c\.id===courseId\)/);
assert.match(api,/Training is not available to this role\."\},403\)/);
assert.match(api,/no-store/);
assert.match(ask,/TrainingAcademy organisationId=/);
assert.match(ask,/activeTab==="training"/);
assert.match(ask,/activeTab==="ask"/);
assert.match(ui,/Authorization:"Bearer "\+token/);
assert.match(ui,/LoadingScreen inline/);
assert.match(ui,/download\(selected,"pdf"\)/);
assert.match(ui,/download\(selected,"pptx"\)/);
assert.match(hq,/href="\/khpos\/hq\/ask"/);
assert.match(out,/createAcademyPdf/);
assert.match(out,/createAcademyPptx/);
assert(!api.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),"Never expose service privileges");
console.log("KHP-OS Training Academy static access, routing and generation checks passed.");

import vm from "node:vm";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
function compile(modulePath, resolve){
  const exports={};
  const js=ts.transpileModule(src(modulePath),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{exports,require:resolve,Buffer,Uint8Array,ArrayBuffer},{filename:modulePath});
  return exports;
}
const curriculum=compile("src/lib/khpos/academy-data.ts",require);
const documentModule=compile("src/lib/khpos/academy-documents.ts",(id)=>require(id));
assert.equal(curriculum.ACADEMY_COURSES.length,3);
assert.deepEqual(Array.from(curriculum.academyForRole(["TEACHER"],false),c=>c.id),["staff"]);
assert.deepEqual(Array.from(curriculum.academyForRole(["TEACHER","SECTIONAL_PROMOTER"],false),c=>c.id),["staff","leadership"]);
assert.deepEqual(Array.from(curriculum.academyForRole([],true),c=>c.id),["staff","leadership","hq"]);
for (const course of curriculum.ACADEMY_COURSES){
 const pptx=Buffer.from(documentModule.createAcademyPptx(course));
 assert.equal(pptx.readUInt32LE(0),0x04034b50,"PPTX must have ZIP local header");
 assert.equal(pptx.readUInt32LE(pptx.length-22),0x06054b50,"PPTX must have ZIP end record");
 assert(pptx.includes("ppt/slideMasters/slideMaster1.xml"),"PPTX has an explicit slide master");
 assert(pptx.includes("ppt/slides/slide1.xml"),"PPTX contains slides");
 const pdf=await documentModule.createAcademyPdf(course);
 const {PDFDocument}=require("pdf-lib");
 const parsed=await PDFDocument.load(pdf);
 assert(parsed.getPageCount()>=course.lessons.length+1,"PDF must cover all lessons");
}
console.log("KHP-OS Training Academy role matrix, PDF generation and PowerPoint ZIP checks passed.");
