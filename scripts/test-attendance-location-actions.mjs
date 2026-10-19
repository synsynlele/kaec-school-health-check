import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const school=id(1), campus=id(2), actor=id(3), session=id(4), engagement=id(5);
let row, updated, evaluations=0, stale=false, permitted=true;
const db = { from(table) {
  const query = { updateValue: null,
    select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
    update(value) { this.updateValue=value; return this; },
    async maybeSingle() {
      return { data: table==="kaec_hq_pathfinder_sessions" ? {...row} : table==="organisations" ? {id:school,status:"active",partner_status:"active",partner_entitlements:["khpos_core"]} : {id:campus}, error:null };
    },
    then(resolve,reject) {
      if(this.updateValue) { if(!stale) { updated=this.updateValue;row={...row,...updated}; } return Promise.resolve({data:stale?[]:[{id:session}],error:null}).then(resolve,reject); }
      return Promise.resolve({data:[row],error:null}).then(resolve,reject);
    },
  }; return query;
} };
class SchoolDeskError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/khpos/hq-sessions.ts","utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText, {exports,Date,process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://test.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-only"}},require(name){
  if(name==="@/lib/http")return {UUID_RE:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i};
  if(name==="@supabase/supabase-js")return {createClient:()=>db};
  if(name==="@/lib/khpos/attendance-location-server")return {evaluateAttendanceLocation:async(input,c)=>{evaluations++;assert.equal(c,campus);return {status:input.status==="captured"?"within_boundary":"denied",receivedAt:new Date().toISOString()};}};
  if(name==="@/lib/khpos/hq-schools")return {SchoolDeskError,getSchoolDesk:async()=>({viewer:{userId:actor,role:"school_pathfinder",aal:"aal1"},engagements:permitted?[{id:engagement,organisation_id:school,engagement_status:"active",representative_user_id:actor}]:[],capped:false})};
  throw new Error("Unexpected module "+name);
} });
function reset(){row={id:session,engagement_id:engagement,campus_id:campus,representative_user_id:actor,mode:"onsite",status:"scheduled",created_by:id(99),updated_at:"2026-10-01T00:00:00Z"};updated=null;stale=false;permitted=true;}
const user={id:actor,email:"test@invalid",aal:"aal1"};
reset();await exports.actOnPathfinderSession(user,{id:session,action:"check_in",campus_id:id(88),location:{status:"captured"}});
assert.equal(updated.campus_id,campus,"Stored scheduled campus wins over a submitted different campus");
assert.equal(updated.check_in_location.status,"within_boundary");assert.equal(updated.status,"checked_in");assert(updated.check_in_at);
await exports.actOnPathfinderSession(user,{id:session,action:"check_out",location:{status:"denied"},outcome_note:"Completed implementation review and mentoring with documented outcomes"});
assert.equal(updated.check_out_location.status,"denied");assert.equal(updated.status,"completed");assert(updated.check_out_at);
const before=evaluations;reset();
await assert.rejects(exports.actOnPathfinderSession({...user,id:id(90)},{id:session,action:"check_in",location:{status:"captured"}}),/assigned Pathfinder/);
assert.equal(evaluations,before,"No GPS evaluation before role/assignment authorization");assert.equal(updated,null);
reset();permitted=false;await assert.rejects(exports.actOnPathfinderSession(user,{id:session,action:"check_in"}),/scope/);assert.equal(updated,null);
reset();stale=true;await assert.rejects(exports.actOnPathfinderSession(user,{id:session,action:"check_in",location:{status:"captured"}}),/changed/);assert.equal(row.status,"scheduled");assert.equal(updated,null);
console.log("Pathfinder location action integration passed: current assignment/school scope, scheduled campus binding, in/out evidence in atomic optimistic updates and stale-write rejection.");
