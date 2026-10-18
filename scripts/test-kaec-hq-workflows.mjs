import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/khpos/hq.ts", "utf8");
const route = fs.readFileSync("src/app/api/khpos/hq/route.ts","utf8");
const ui = fs.readFileSync("src/components/khpos/KaecHqWorkspace.tsx","utf8");
const migration = fs.readFileSync("supabase/migrations/20261018113000_kaec_hq_operational_workflows.sql","utf8");
const uuid = (n) => String(n).padStart(8,"0") + "-0000-4000-8000-000000000000";
const members = [
  {user_id:uuid(1),email:"worker@example.test",display_name:"Worker",role:"team_member",status:"active"},
  {user_id:uuid(2),email:"steward@example.test",display_name:"Steward",role:"system_steward",status:"active"},
  {user_id:uuid(3),email:"finance@example.test",display_name:"Finance",role:"finance_steward",status:"active"},
  {user_id:uuid(4),email:"vision@example.test",display_name:"Vision",role:"vision_custodian",status:"active"},
];
const user = (i,aal="aal2") => ({id:members[i].user_id,email:members[i].email,aal});
const now = "2026-10-18T10:00:00.000Z";
const record = (index, module, record_type, owner=0, creator=0, priority="normal") => ({
  id:uuid(index),module,record_type,title:"Corporate example work "+index,description:"",
  status:"active",priority,owner_user_id:members[owner].user_id,
  backup_user_id:null,due_on:"2026-10-22",cadence:"once",amount:null,currency:"NGN",
  created_by:members[creator].user_id,updated_by:members[creator].user_id,
  reviewed_by:null,reviewed_at:null,evidence_note:"",review_note:"",
  series_root_id:null,previous_cycle_id:null,series_anchor_on:null,cycle_index:1,
  created_at:now,updated_at:now,
});
const rows = [
  record(10,"work","task"),
  record(11,"work","report"),
  record(12,"finance","budget",3,3),
  record(13,"partnerships","supervision",0,0),
];
const edits=[];
const adapter = {
  from(table) {
    let filters=[];
    let mode="read",patch=null,ordered=null,limit=null,onlyCount=false;
    const sourceRows=table==="kaec_hq_members"?members:rows;
    function matched() {
      let result=sourceRows.filter(r=>filters.every(f=>f(r)));
      if(ordered)result=result.sort((a,b)=>String(b[ordered]).localeCompare(String(a[ordered])));
      if(limit!==null)result=result.slice(0,limit);
      return result;
    }
    function result() {
      const matches=matched();
      if(mode==="update"){
        for(const row of matches){Object.assign(row,patch);edits.push({record:row.id,updated: {...patch}});}
        return {data:matches.map(r=>({id:r.id})),error:null};
      }
      return {data:onlyCount?null:matches.map(r=>({...r})),count:onlyCount?matches.length:null,error:null};
    }
    const q={
      select(_fields,options){ if(options?.head)onlyCount=true;return q;},
      eq(field,value){filters.push(r=>r[field]===value);return q;},
      in(field,values){filters.push(r=>values.includes(r[field]));return q;},
      or(text){const choices=text.split(",").map(part=>part.split(".eq."));filters.push(r=>choices.some(([k,v])=>r[k]===v));return q;},
      order(field){ordered=field;return q;},
      limit(n){limit=n;return q;},
      update(data){mode="update";patch=data;return q;},
      insert(data){
        const list=Array.isArray(data)?data:[data];
        for(const item of list)rows.push({...record(50+rows.length,item.module??"work",item.record_type??"task"),...item,id:item.id??uuid(50+rows.length),updated_at:now,created_at:now});
        return Promise.resolve({error:null});
      },
      maybeSingle(){const x=result();return Promise.resolve({data:x.data?.[0]??null,error:null});},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);},
    };
    return q;
  },
};
const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL="https://test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test-key";
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("require","module","exports",js)(
  (name)=>{if(name==="@supabase/supabase-js")return {createClient:()=>adapter};throw Error("Unexpected import: "+name);},
  module,module.exports);
const svc=module.exports;
const proof="A complete written evidence statement for this activity.";
const note="Independent review confirmed the submitted evidence.";
const worker=user(0),steward=user(1),finance=user(2),vision=user(3);
await svc.updateHqRecord(worker,{id:uuid(10),title:"Updated routine work title",description:"",record_type:"task",status:"active",priority:"normal",owner_user_id:worker.id,backup_user_id:null,due_on:"2026-10-22",cadence:"once",amount:null,currency:"NGN",evidence_note:""});
assert.equal(rows.find(r=>r.id===uuid(10)).title,"Updated routine work title");
await assert.rejects(svc.completeRoutineHqRecord(steward,{id:uuid(10),evidence_note:proof}),e=>e.status===403);
await assert.rejects(svc.completeRoutineHqRecord(worker,{id:uuid(10),evidence_note:"short"}),e=>e.status===400);
await svc.completeRoutineHqRecord(worker,{id:uuid(10),evidence_note:proof});
assert.equal(rows.find(r=>r.id===uuid(10)).status,"completed");
assert.match(rows.find(r=>r.id===uuid(10)).review_note,/not claimed/);
await assert.rejects(svc.updateHqRecord(worker,{id:uuid(10),title:"Rewritten record"}),e=>e.status===409);
await assert.rejects(svc.createHqRecord(worker,{
  module:"work",record_type:"task",title:"Assign another member",owner_user_id:steward.id,status:"active"
}),e=>e.status===403);
await assert.rejects(svc.completeRoutineHqRecord(worker,{id:uuid(11),evidence_note:proof}),e=>e.status===403);
await svc.submitHqRecord(worker,{id:uuid(11),evidence_note:proof});
assert.equal(rows.find(r=>r.id===uuid(11)).status,"in_review");
await assert.rejects(svc.updateHqRecord(worker,{id:uuid(11),title:"Edit submitted record"}),e=>e.status===409);
await assert.rejects(svc.reviewHqRecord(worker,{id:uuid(11),decision:"approve",note}),e=>e.status===403);
await assert.rejects(svc.reviewHqRecord(steward,{id:uuid(11),decision:"return",note:"short"}),e=>e.status===400);
await svc.reviewHqRecord(steward,{id:uuid(11),decision:"return",note});
assert.equal(rows.find(r=>r.id===uuid(11)).status,"active");
await svc.submitHqRecord(worker,{id:uuid(11),evidence_note:proof});
await svc.reviewHqRecord(steward,{id:uuid(11),decision:"approve",note});
assert.equal(rows.find(r=>r.id===uuid(11)).status,"completed");
assert.equal(rows.find(r=>r.id===uuid(11)).reviewed_by,steward.id);
await assert.rejects(svc.completeRoutineHqRecord(vision,{id:uuid(12),evidence_note:proof}),e=>e.status===403);
await svc.submitHqRecord(vision,{id:uuid(12),evidence_note:proof});
await assert.rejects(svc.reviewHqRecord(vision,{id:uuid(12),decision:"approve",note}),e=>e.status===403);
await assert.rejects(svc.reviewHqRecord(user(2,"aal1"),{id:uuid(12),decision:"approve",note}),e=>e.status===403);
await svc.reviewHqRecord(finance,{id:uuid(12),decision:"approve",note});
assert.equal(rows.find(r=>r.id===uuid(12)).status,"completed");
await assert.rejects(svc.submitHqRecord(worker,{id:uuid(13),evidence_note:proof}),e=>e.status===403);
assert(route.includes('case "submit"') && route.includes('case "complete"'));
assert(ui.includes('Log routine completion') && ui.includes('Submit for verification') && ui.includes('Reviewer decision and reason'));
for(const key of ["evidence_note","review_note","series_anchor_on","kaec_hq_work_roll_forward","make_interval","on conflict"])assert(migration.includes(key),"Missing "+key);
assert(edits.length>=8,"Expected actual write transitions to be exercised");
console.log("KAEC HQ operational tests passed: routine owner attestation, evidence, independent return/approval, finance MFA, immutability and server routes.");
if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;
if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;
