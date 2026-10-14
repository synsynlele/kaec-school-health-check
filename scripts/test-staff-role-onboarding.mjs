import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const school={id:'school',name:'Test school',status:'active',partner_status:'active',partner_entitlements:['khpos_core']};
const tables={
 organisation_memberships:[{organisation_id:'school',user_id:'person',status:'active',organisations:school}],
 khpos_ops_staff:[{id:'staff-person',organisation_id:'school',user_id:'person',status:'active',desired_role_id:'teacher'}],
 khpos_ops_staff_role_positions:[
  {organisation_id:'school',staff_id:'staff-person',role_id:'skills',status:'pending'},
  {organisation_id:'other-school',staff_id:'staff-person',role_id:'foreign',status:'pending'},
  {organisation_id:'school',staff_id:'staff-person',role_id:'ended',status:'ended'},
  {organisation_id:'school',staff_id:'colleague-staff',role_id:'other-person',status:'pending'},
 ],
 khpos_ops_role_assignments:[
  {role_id:'foreign',user_id:'person',status:'active',primary_assignment:true},
  {role_id:'teacher',user_id:'person',status:'active',primary_assignment:true},
  {role_id:'promoter',user_id:'person',status:'active',primary_assignment:false},
  {role_id:'other-person',user_id:'colleague',status:'active',primary_assignment:true},
  {role_id:'ended',user_id:'person',status:'ended',primary_assignment:false},
 ],
 khpos_ops_roles:[
  {id:'foreign',organisation_id:'other-school',title:'Foreign position',code:'SCHOOL_CUSTODIAN',status:'active'},
  {id:'teacher',organisation_id:'school',title:'Teacher',code:'TEACHER',status:'active'},
  {id:'promoter',organisation_id:'school',title:'Sectional Promoter',code:'SECTIONAL_PROMOTER',status:'active'},
  {id:'skills',organisation_id:'school',title:'Skills Facilitator',code:'SKILLS_FACILITATOR',status:'active'},
  {id:'other-person',organisation_id:'school',title:'Colleague position',code:'ACADEMIC_INSPECTOR',status:'active'},
  {id:'ended',organisation_id:'school',title:'Ended position',code:'SKILLS_FACILITATOR',status:'active'},
 ],
 khpos_ops_role_charters:[{role_id:'teacher',mission:'Teach assigned learners',status:'active'},{role_id:'promoter',mission:'Support the section',status:'active'},{role_id:'skills',mission:'Facilitate skills practice',status:'active'}],
};
const client={from(table){let rows=tables[table] ?? [];const query={
 select(){return query;},eq(field,value){rows=rows.filter(row=>row[field]===value);return query;},
 neq(field,value){rows=rows.filter(row=>row[field]!==value);return query;},
 in(field,values){rows=rows.filter(row=>values.includes(row[field]));return query;},
 order(){return query;},limit(size){rows=rows.slice(0,size);return query;},
 maybeSingle(){return Promise.resolve({data:rows[0] ?? null,error:null});},
 then(resolve,reject){return Promise.resolve({data:rows,error:null}).then(resolve,reject);},
};return query;}};
const testModule={exports:{}};
const code=ts.transpileModule(fs.readFileSync('src/lib/khpos/ops/onboarding.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','module','exports','process',code)(()=>({createClient:()=>client}),testModule,testModule.exports,{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-fixture'}});
const {getKhposMyOnboarding}=testModule.exports;
let result=await getKhposMyOnboarding('school','person');
assert.equal(result.role.id,'teacher','A primary assignment in another school must not become the default');
assert.deepEqual(result.roleChoices.map(role=>role.id),['teacher','promoter','skills']);
assert.equal(result.roleChoices.find(role=>role.id==='skills').pending,true);
assert.equal(result.roleChoices.find(role=>role.id==='teacher').pending,false);
assert.equal(result.charter.mission,'Teach assigned learners');
result=await getKhposMyOnboarding('school','person','promoter');
assert.equal(result.charter.mission,'Support the section');
assert.equal(result.role.activeAssignment,true);
result=await getKhposMyOnboarding('school','person','skills');
assert.equal(result.charter.mission,'Facilitate skills practice');
assert.equal(result.role.activeAssignment,false,'Pending positions must not grant active authority');
for(const role of ['foreign','other-person','ended','unknown']) await assert.rejects(getKhposMyOnboarding('school','person',role),error=>error.status===403);
await assert.rejects(getKhposMyOnboarding('school','colleague'),error=>error.status===403);
console.log('Staff role onboarding: own active positions, school boundaries, default selection and selected duties passed.');
