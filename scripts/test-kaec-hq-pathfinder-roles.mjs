import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const id=n=>String(n).padStart(8,"0")+"-0000-4000-8000-000000000000";
const roles=["vision_custodian","system_steward","alliance_catalyst","product_architect","movement_curator","finance_steward","team_member","school_pathfinder"];
const members=[
  {user_id:id(1),email:"vision@test.invalid",display_name:"Vision",role:"vision_custodian",status:"active"},
  {user_id:id(2),email:"guide-a@test.invalid",display_name:"Guide A",role:"school_pathfinder",status:"active"},
  {user_id:id(3),email:"guide-b@test.invalid",display_name:"Guide B",role:"school_pathfinder",status:"active"},
  {user_id:id(4),email:"alliance@test.invalid",display_name:"Alliance",role:"alliance_catalyst",status:"active"},
  {user_id:id(5),email:"outsider@test.invalid",display_name:"Outsider",role:"team_member",status:"active"}
];
const organisations=[
  {id:id(10),name:"Partner A",status:"active",partner_status:"active",partner_entitlements:["khpos_core"]},
  {id:id(11),name:"Partner B",status:"active",partner_status:"active",partner_entitlements:["khpos_core"]},
  {id:id(12),name:"KAEC Nigerian Schools",status:"active",partner_status:"active",partner_entitlements:["khpos_core"]}
];
const engagement=(i,org,rep)=>({id:id(i),organisation_id:id(org),engagement_status:"active",
  agreement_reference:"SIGNED-AGREE-01",agreed_scope:"School support and evidenced HQLS implementation for the agreed period",
  contract_verified_at:"2026-10-17T09:00:00Z",contract_verified_by:id(1),representative_user_id:id(rep),
  school_liaison:"Principal",next_virtual_check_on:"2026-10-23",next_site_visit_on:null,
  created_at:"2026-10-17T09:00:00Z",updated_at:"2026-10-17T09:00:00Z"});
const engagements=[engagement(20,10,2),engagement(21,11,3)];
const commitment=(i,eng,creator)=>({id:id(i),engagement_id:id(eng),title:"Agreed teacher HQLS quality",
  agreed_expectation:"Teachers demonstrate the teaching lesson workflow as agreed",
  agreement_clause:"Implementation-plan-2",evidence_expected:"An approved anonymized quality summary",
  status:"planned",priority:"normal",due_on:"2026-10-25",next_followup_on:"2026-10-23",
  followup_mode:"virtual",progress_note:"",evidence_reference:"",verified_by:null,verified_at:null,
  created_by:id(creator),updated_by:id(creator),created_at:"2026-10-17T09:00:00Z",updated_at:"2026-10-17T09:00:00Z"});
const commitments=[commitment(30,20,4),commitment(31,21,4)];
const followups=[];
const tableRows={kaec_hq_members:members,organisations,kaec_hq_school_engagements:engagements,
  kaec_hq_school_commitments:commitments,kaec_hq_school_followups:followups};
const adapter={
  from(table){
    const rows=tableRows[table];if(!rows)throw Error("Unknown table: "+table);
    let predicates=[],sort=null,lim=null,patch=null;
    const selected=()=>{let out=rows.filter(r=>predicates.every(test=>test(r)));
      if(sort)out=[...out].sort((a,b)=>String(b[sort]).localeCompare(String(a[sort])));
      if(lim!==null)out=out.slice(0,lim);return out;};
    const output=()=>{const found=selected();
      if(patch){for(const row of found)Object.assign(row,patch);return {data:found.map(row=>({id:row.id})),error:null};}
      return {data:found.map(row=>({...row})),error:null};};
    const query={
      select(){return query;},eq(key,value){predicates.push(row=>row[key]===value);return query;},
      in(key,values){predicates.push(row=>values.includes(row[key]));return query;},
      order(key){sort=key;return query;},limit(n){lim=n;return query;},
      update(data){patch=data;return query;},
      insert(data){const row={...data,id:id(100+rows.length),created_at:"2026-10-18T09:00:00Z",
        happened_at:"2026-10-18T09:00:00Z",updated_at:"2026-10-18T09:00:00Z"};
        rows.push(row);return Promise.resolve({data:null,error:null});},
      maybeSingle(){const r=output();return Promise.resolve({data:r.data[0]??null,error:null});},
      then(resolve,reject){return Promise.resolve(output()).then(resolve,reject);}
    };return query;
  }
};
const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="fixture";
try{
  const src=fs.readFileSync("src/lib/khpos/hq-schools.ts","utf8");
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const testModule={exports:{}};
  new Function("require","module","exports",js)((name)=>{
    if(name==="@supabase/supabase-js")return {createClient:()=>adapter};
    if(name==="@/lib/khpos/hq")return {HQ_ROLES:roles};
    throw Error("Unexpected import "+name);
  },testModule,testModule.exports);
  const svc=testModule.exports;
  const user=(index,aal="aal2")=>({id:members[index].user_id,email:members[index].email,aal});
  const vision=user(0),guide=user(1),otherGuide=user(2),alliance=user(3),outsider=user(4);
  const restricted=await svc.getSchoolDesk(guide);
  assert.deepEqual(restricted.engagements.map(e=>e.id),[id(20)]);
  assert.deepEqual(restricted.commitments.map(c=>c.id),[id(30)]);
  assert.deepEqual(restricted.organisations.map(o=>o.id),[id(10)]);
  assert.deepEqual(restricted.members.map(m=>m.user_id),[guide.id]);
  const leader=await svc.getSchoolDesk(vision);
  assert.equal(leader.engagements.length,2);
  assert(!leader.organisations.some(o=>o.name==="KAEC Nigerian Schools"));
  await assert.rejects(svc.getSchoolDesk(outsider),e=>e.status===403);
  await assert.rejects(svc.createSchoolEngagement(guide,{organisation_id:id(11)}),e=>e.status===403);
  await assert.rejects(svc.logSchoolFollowup(guide,{commitment_id:id(31),mode:"whatsapp",outcome:"Confirmed school activities from last week"}),e=>e.status===403);
  await assert.rejects(svc.updateSchoolCommitment(otherGuide,{id:id(30),status:"in_progress",progress_note:"School reports work started as expected"}),e=>e.status===403);
  await svc.logSchoolFollowup(guide,{commitment_id:id(30),mode:"video",
    outcome:"School counterpart displayed anonymized lesson plan work on a video call",
    next_followup_on:"2026-10-24"});
  assert.equal(followups.length,1);
  assert.equal((await svc.getSchoolDesk(guide)).followups.length,1);
  await svc.updateSchoolCommitment(guide,{id:id(30),status:"evidence_submitted",
    progress_note:"School supplied an anonymized lesson implementation sample",
    evidence_reference:"Approved-School-Report-12",next_followup_on:"2026-10-25"});
  await assert.rejects(svc.verifySchoolCommitment(guide,{id:id(30),decision:"verify",
    decision_note:"Verified independent school evidence"}),e=>e.status===403);
  await svc.verifySchoolCommitment(vision,{id:id(30),decision:"verify",
    decision_note:"Verified anonymized school evidence against agreement"});
  assert.equal(commitments[0].status,"verified");
  await assert.rejects(svc.updateSchoolEngagement(guide,{id:id(21),engagement_status:"active"}),e=>e.status===403);
  await assert.rejects(svc.updateSchoolEngagement(vision,{id:id(20),engagement_status:"active",
    agreement_reference:"CHANGED-AGREEMENT",agreed_scope:engagements[0].agreed_scope,confirm_verified:false}),e=>e.status===409);
  await assert.rejects(svc.updateSchoolEngagement(user(0,"aal1"),{id:id(20),engagement_status:"active"}),e=>e.status===403);
  assert.equal(alliance.role,undefined);
  const route=fs.readFileSync("src/app/api/khpos/hq/schools/route.ts","utf8");
  const ui=fs.readFileSync("src/components/khpos/SchoolPathfinderDesk.tsx","utf8");
  for(const name of ['"create_engagement"','"update_engagement"','"add_commitment"','"followup"','"verify"'])assert(route.includes(name),"missing "+name);
  assert(ui.includes("School Pathfinders")&&ui.includes("Log contact / visit")&&ui.includes("Evidence expected"));
  console.log("School Pathfinder role tests passed: exact school scoping, no orphan access, virtual follow-up, evidence, independent verification, agreement/MFA gate.");
}finally{
  if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;
  if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;
}
