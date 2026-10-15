import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Simulate one person with primary Teacher + active Skill Facilitator and
// pending Sectional Promoter. Other schools and other people must not leak in.
const org="school-1", user="user-1", peer="user-2";
const workspace={
  organisation:{id:org,name:"Test School"},
  roles:[
    {id:"teacher",code:"TEACHER",title:"Teacher"},
    {id:"skill",code:"SKILLS_FACILITATOR",title:"Skills Facilitator"},
    {id:"promoter",code:"SECTIONAL_PROMOTER",title:"Sectional Promoter"},
  ],
  campuses:[{id:"campus-1",name:"Main Campus"},{id:"campus-2",name:"New Campus"}],
  units:[{id:"unit-1",name:"Secondary"}],
  items:[
    {id:"staff-1",displayName:"Sample Staff",roleAssignmentId:"assignment-primary",role:{id:"teacher",code:"TEACHER",title:"Teacher"}},
    {id:"staff-2",displayName:"Second Staff",roleAssignmentId:"assignment-peer",role:{id:"teacher",code:"TEACHER",title:"Teacher"}}
  ]
};
const tables={
  khpos_ops_staff:[
    {id:"staff-1",organisation_id:org,user_id:user},
    {id:"staff-2",organisation_id:org,user_id:peer},
    {id:"staff-foreign",organisation_id:"school-2",user_id:user}
  ],
  khpos_ops_role_assignments:[
    {id:"assignment-primary",user_id:user,role_id:"teacher",campus_id:"campus-1",unit_id:null,status:"active"},
    {id:"assignment-extra",user_id:user,role_id:"skill",campus_id:"campus-1",unit_id:"unit-1",status:"active"},
    {id:"assignment-peer",user_id:peer,role_id:"teacher",campus_id:"campus-1",unit_id:null,status:"active"},
    {id:"assignment-other-school",user_id:user,role_id:"foreign-role",campus_id:"foreign-campus",unit_id:null,status:"active"},
    {id:"assignment-ended",user_id:user,role_id:"promoter",campus_id:"campus-1",unit_id:null,status:"ended"},
  ],
  khpos_ops_staff_role_positions:[
    {id:"position-pending",staff_id:"staff-1",organisation_id:org,role_id:"promoter",campus_id:"campus-2",unit_id:null,acknowledged_at:"2026-10-15",status:"pending"},
    {id:"position-active",staff_id:"staff-1",organisation_id:org,role_id:"skill",campus_id:"campus-1",unit_id:"unit-1",acknowledged_at:"2026-10-15",status:"active"},
    {id:"position-other-school",staff_id:"staff-1",organisation_id:"school-2",role_id:"promoter",campus_id:"campus-1",unit_id:null,acknowledged_at:null,status:"pending"},
    {id:"position-peer",staff_id:"staff-2",organisation_id:org,role_id:"promoter",campus_id:"campus-1",unit_id:null,acknowledged_at:null,status:"pending"},
  ],
};
let queries=0;
const client={
  rpc:async(name,args)=>{assert.equal(name,"khpos_ops_get_people_server");assert.equal(args.p_organisation_id,org);return {data:structuredClone(workspace),error:null};},
  from(table){
    assert.ok(Object.hasOwn(tables,table),"unexpected people enrichment table: "+table);
    let rows=tables[table].slice();
    const q={
      select(){return q;},
      eq(field,value){rows=rows.filter(row=>row[field]===value);return q;},
      in(field,values){rows=rows.filter(row=>values.includes(row[field]));return q;},
      then(resolve,reject){queries++;return Promise.resolve({data:rows,error:null}).then(resolve,reject);}
    };
    return q;
  }
};
const testModule={exports:{}};
const source=ts.transpileModule(fs.readFileSync("src/lib/khpos/ops/people.ts","utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
new Function("require","module","exports","process",source)(
  ()=>({createClient:()=>client}),testModule,testModule.exports,{
    env:{NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"isolated-fixture"}
  }
);
const result=await testModule.exports.getKhposOpsPeople(org,user);
assert.equal(result.items.length,2,"Role assignments must never become duplicate staff profiles");
assert.equal(result.items[0].role.title,"Teacher","Original primary role is preserved");
assert.deepEqual(result.items[0].positions.activeAdditional.map(position=>position.title),["Skills Facilitator"]);
assert.deepEqual(result.items[0].positions.pendingAdditional.map(position=>[position.title,position.accepted]),[["Sectional Promoter",true]]);
assert.equal(result.items[0].positions.activeAdditional[0].unitName,"Secondary");
assert.equal(result.items[0].positions.pendingAdditional[0].campusName,"New Campus");
assert.equal(result.items[1].positions.activeAdditional.length,0);
assert.deepEqual(result.items[1].positions.pendingAdditional.map(position=>position.title),["Sectional Promoter"]);
assert.equal(queries,3,"Bulk enrichment must use three scoped queries, not one query per staff");
const ui=fs.readFileSync("src/components/khpos/ops/PeopleWorkspace.tsx","utf8");
const panel=fs.readFileSync("src/components/khpos/ops/StaffPositionsPanel.tsx","utf8");
assert.match(ui,/Positions held by this staff member/);
assert.match(ui,/staff\.positions\?\.activeAdditional/);
assert.match(ui,/staff\.positions\?\.pendingAdditional/);
assert.match(ui,/Manage positions/);
assert.match(panel,/selectedStaffId/);
assert.match(panel,/onPositionsChanged/);
assert.match(panel,/!people && <ul className="space-y-2">\{positions\.activePositions/);
console.log("Consolidated staff positions: one profile per person, primary retained, active and pending roles in school scope, without separate active listings.");
