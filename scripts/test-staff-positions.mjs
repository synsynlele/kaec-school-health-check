import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = (number) => `00000000-0000-0000-0000-${String(number).padStart(12,'0')}`;
const org=id(1), campus=id(2), section=id(3), otherOrg=id(4), otherCampus=id(5), otherSection=id(6);
const leader=id(10), owner=id(11), inspector=id(12), promoter=id(13), guardian=id(14);
const custodianRole=id(20), teacherRole=id(21), promoterRole=id(22), inspectorRole=id(23), guardianRole=id(24), skillsRole=id(25);
const staff=id(30), primary=id(31), work=id(32), ownWork=id(33), charter=id(34);
let checks=0;
async function q(sql,args=[]) { return (await db.query(sql,args)).rows; }
async function denied(sql,args,pattern) { await assert.rejects(q(sql,args),pattern); checks++; }
async function action(actor,mode,input,school=org) { return (await q('select public.khpos_ops_role_position_action_server($1,$2,$3,$4) as id',[actor,school,mode,input]))[0].id; }
async function positions(actor,staffId=null) { return (await q('select public.khpos_ops_get_role_positions_server($1,$2,$3) as value',[actor,org,staffId]))[0].value; }
async function route(actor,target=work) { return (await q('select khpos_private.ops_work_review_route($1,$2,$3) as role',[actor,org,target]))[0].role; }
const mutation='select public.khpos_ops_role_position_action_server($1,$2,$3,$4)';
try {
 await db.exec('create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);');
 await db.exec(fs.readFileSync('scripts/fixtures/staff-positions-schema.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261012104812_multiple_staff_positions.sql','utf8'));
 for(const school of [org,otherOrg]) await q("insert into organisations(id,status,partner_status) values($1,'active','active')",[school]);
 for(const person of [leader,owner,inspector,promoter,guardian]) { await q('insert into auth.users(id) values($1)',[person]); await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[org,person]); }
 for(const [c,o] of [[campus,org],[otherCampus,otherOrg]]) await q("insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,'Campus','active')",[c,o]);
 for(const [u,c,o] of [[section,campus,org],[otherSection,otherCampus,otherOrg]]) await q("insert into khpos_ops_units(id,campus_id,organisation_id,name,status) values($1,$2,$3,'Section','active')",[u,c,o]);
 for(const [r,code,parent] of [[custodianRole,'SCHOOL_CUSTODIAN',null],[guardianRole,'SCHOOL_GUARDIAN',custodianRole],[inspectorRole,'ACADEMIC_INSPECTOR',guardianRole],[promoterRole,'SECTIONAL_PROMOTER',inspectorRole],[teacherRole,'TEACHER',promoterRole],[skillsRole,'SKILLS_FACILITATOR',inspectorRole]]) await q("insert into khpos_ops_roles(id,organisation_id,code,title,reports_to_role_id,status) values($1,$2,$3,$3,$4,'active')",[r,org,code,parent]);
 for(const [a,r,u,c,s,primaryFlag] of [[id(40),custodianRole,leader,null,null,true],[primary,teacherRole,owner,campus,section,true],[id(42),inspectorRole,inspector,campus,section,true],[id(43),guardianRole,guardian,null,null,true]]) await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,primary_assignment,status) values($1,$2,$3,$4,$5,$6,'active')",[a,r,u,c,s,primaryFlag]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,status,desired_role_id,role_assignment_id,campus_id) values($1,$2,$3,'active',$4,$5,$6)",[staff,org,owner,teacherRole,primary,campus]);
 await q("insert into khpos_ops_role_charters(id,role_id,mission,responsibilities,decision_rights,escalation_rules,required_policy_codes,status) values($1,$2,'Lead this section','[\"Support teachers\"]','[]','[]','{}','active')",[charter,promoterRole]);
 const proposed=await action(leader,'propose',{staffId:staff,roleId:promoterRole,campusId:campus,unitId:section});
 assert.equal((await positions(owner)).activePositions.length,1); checks++;
 assert.equal((await positions(owner)).appointments[0].status,'pending'); checks++;
 await denied(mutation,[owner,org,'activate',{positionId:proposed,note:'I should not activate my own appointment.'}],/different authorised/);
 await denied(mutation,[leader,org,'activate',{positionId:proposed,note:'Reviewed readiness with this member of staff.'}],/Complete role acknowledgement/);
 await denied(mutation,[leader,org,'propose',{staffId:staff,roleId:promoterRole,campusId:campus,unitId:section}],/overlapping position/);
 await denied(mutation,[leader,org,'propose',{staffId:staff,roleId:skillsRole,campusId:otherCampus}],/active campus/);
 await denied(mutation,[leader,org,'propose',{staffId:staff,roleId:skillsRole,campusId:campus,unitId:otherSection}],/does not belong/);
 await denied(mutation,[leader,otherOrg,'propose',{staffId:staff,roleId:skillsRole,campusId:otherCampus}],/membership/);
 await denied(mutation,[guardian,org,'propose',{staffId:staff,roleId:guardianRole,campusId:campus}],/authority/);
 await action(owner,'acknowledge',{positionId:proposed,note:'I accept responsibility for supporting this section.'});
 await q("insert into khpos_ops_practice_runs(organisation_id,user_id,scenario_code,status) values($1,$2,'KHPOS_CORE_V1','completed')",[org,owner]);
 await q("update khpos_ops_role_charters set required_policy_codes=array['SAFEGUARDING'] where id=$1",[charter]);
 await denied(mutation,[leader,org,'activate',{positionId:proposed,note:'Reviewed readiness with this member of staff.'}],/Complete role acknowledgement/);
 const policy=id(50), version=id(51);
 await q("insert into khpos_ops_policies(id,organisation_id,code,name,status) values($1,$2,'SAFEGUARDING','Safeguarding','active')",[policy,org]);
 await q("insert into khpos_ops_policy_versions(id,policy_id,status) values($1,$2,'active')",[version,policy]);
 await q('insert into khpos_ops_policy_acknowledgements(organisation_id,user_id,policy_version_id) values($1,$2,$3)',[org,owner,version]);
 // Charter changes invalidate acceptance rather than transferring it silently.
 await q("update khpos_ops_role_charters set status='superseded' where id=$1",[charter]);
 await q("insert into khpos_ops_role_charters(id,role_id,mission,responsibilities,decision_rights,escalation_rules,required_policy_codes,status) values($1,$2,'Updated section responsibilities','[]','[]','[]',array['SAFEGUARDING'],'active')",[id(52),promoterRole]);
 await denied(mutation,[leader,org,'activate',{positionId:proposed,note:'Reviewed readiness with this member of staff.'}],/Complete role acknowledgement/);
 await action(owner,'acknowledge',{positionId:proposed,note:'I have read and accept the updated section duties.'});
 await action(leader,'activate',{positionId:proposed,note:'I independently reviewed the duties and readiness.'});
 const active=await positions(owner);
 assert.equal(active.activePositions.length,2); assert.equal(active.activePositions.filter(p=>p.primary).length,1); checks+=2;
 assert.equal((await q('select role_assignment_id from khpos_ops_staff where id=$1',[staff]))[0].role_assignment_id,primary); checks++;
 await denied(mutation,[leader,org,'propose',{staffId:staff,roleId:promoterRole,campusId:campus,unitId:section}],/already covers/);
 await q("insert into khpos_ops_work_items(id,organisation_id,campus_id,unit_id,owner_assignment_id,status,title) values($1,$2,$3,$4,$5,'awaiting_verification','Teacher submission')",[work,org,campus,section,primary]);
 assert.equal(await route(owner),null); assert.equal(await route(inspector),inspectorRole); checks+=2;
 await denied('select khpos_ops_verify_work_server($1,$2,$3,$4,$5)',[owner,org,work,'verify',null],/cannot verify their own/);
 assert.equal((await q('select khpos_ops_get_verification_routes_server($1,$2) as routes',[inspector,org]))[0].routes[0].reviewerRoleId,inspectorRole); checks++;
 await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",[id(53),promoterRole,promoter,campus,section]);
 assert.equal(await route(promoter),promoterRole); assert.equal(await route(inspector),null); checks+=2;
 await q('update khpos_ops_role_assignments set unit_id=$1 where id=$2',[otherSection,id(53)]);
 assert.equal(await route(promoter),null); assert.equal(await route(inspector),inspectorRole); checks+=2;
 await q('update khpos_ops_work_items set campus_id=null,unit_id=null where id=$1',[work]);
 assert.equal(await route(inspector),null); assert.equal(await route(guardian),guardianRole); checks+=2;
 await q('update khpos_ops_work_items set campus_id=$1,unit_id=$2 where id=$3',[campus,section,work]);
 await q('select khpos_ops_verify_work_server($1,$2,$3,$4,$5)',[inspector,org,work,'return','Please correct the evidence.']);
 assert.equal((await q('select status from khpos_ops_work_items where id=$1',[work]))[0].status,'in_progress'); checks++;
 await q("update khpos_ops_work_items set status='awaiting_verification' where id=$1",[work]);
 await q('select khpos_ops_verify_work_server($1,$2,$3,$4,$5)',[inspector,org,work,'verify','Reviewed independently.']);
 assert.equal((await q('select status from khpos_ops_work_items where id=$1',[work]))[0].status,'completed'); checks++;
 const secondary=active.activePositions.find(p=>!p.primary).assignmentId;
 await q("insert into khpos_ops_work_items(id,organisation_id,owner_assignment_id,status,title) values($1,$2,$3,'in_progress','Section work')",[ownWork,org,secondary]);
 await denied(mutation,[leader,org,'end',{positionId:proposed,note:'Handover completed for this role.'}],/hand over open work/);
 await q("update khpos_ops_work_items set status='completed' where id=$1",[ownWork]);
 await action(leader,'end',{positionId:proposed,note:'All section duties were handed over.'});
 assert.equal((await positions(owner)).activePositions.length,1); checks++;
 for(const actor of ['anon','authenticated']) {
  assert.equal((await q("select has_function_privilege($1,'public.khpos_ops_role_position_action_server(uuid,uuid,text,jsonb)','EXECUTE') as allowed",[actor]))[0].allowed,false); checks++;
 }
 assert.equal((await q("select relrowsecurity from pg_class where oid='public.khpos_ops_staff_role_positions'::regclass"))[0].relrowsecurity,true); checks++;
 console.log(`Staff positions: ${checks} PostgreSQL checks passed (isolated column-schema fixture; no production records changed).`);
} finally { await db.close(); }
