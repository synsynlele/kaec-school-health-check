import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12,"0");
const org=id(1), campus=id(2),otherOrg=id(3),otherCampus=id(4),unit=id(5);
const teacher=id(10), guardian=id(11),observer=id(12), other=id(13);
const teacherRole=id(20),guardianRole=id(21),inspectorRole=id(22),custodianRole=id(23),otherCustodianRole=id(24);
const teacherAssignment=id(30),guardianAssignment=id(31),observerAssignment=id(32);
const staffId=id(40),term=id(50),stream=id(51);
let checks=0;
async function q(sql,args=[]) {return (await db.query(sql,args)).rows;}
async function fail(sql,args,regex) {await assert.rejects(q(sql,args),regex);checks++;}
async function act(actor,mode,input,school=org) {return (await q("select public.khpos_ops_presence_action_server($1,$2,$3,$4) as result",[actor,school,mode,input]))[0].result;}
async function read(actor,school=org){return (await q("select public.khpos_ops_presence_workspace_server($1,$2) as result",[actor,school]))[0].result;}

try {
 await db.exec("create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
 await db.exec(fs.readFileSync("scripts/fixtures/staff-positions-schema.sql","utf8"));
 await db.exec(`
  create table public.khpos_ops_academic_terms(
    id uuid primary key, organisation_id uuid, campus_id uuid, start_date date, end_date date,status text
  );
  create table public.khpos_ops_academic_delivery_streams(
    id uuid primary key, organisation_id uuid, term_id uuid, campus_id uuid, unit_id uuid,
    class_label text, subject_label text, teacher_assignment_id uuid, status text
  );
  create or replace function khpos_private.ops_academic_has_membership(p_actor uuid,p_org uuid)
  returns boolean language sql stable as $$
    select khpos_private.ops_hpd_has_membership(p_actor,p_org);
  $$;
 `);
 await db.exec(fs.readFileSync("supabase/migrations/20261013090000_khpos_presence_class_hqls.sql","utf8"));
 for(const [n,name] of [[org,"Test School"],[otherOrg,"Other School"]])
   await q("insert into organisations(id,name,status,partner_status,partner_entitlements) values($1,$2,'active','active',array['khpos_core'])",[n,name]);
 for(const u of [teacher,guardian,observer,other]) await q("insert into auth.users(id) values($1)",[u]);
 for(const u of [teacher,guardian,observer]) await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[org,u]);
 await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[otherOrg,other]);
 for(const [c,o] of [[campus,org],[otherCampus,otherOrg]])
   await q("insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,'Campus','active')",[c,o]);
 await q("insert into khpos_ops_units(id,organisation_id,campus_id,name) values($1,$2,$3,'JSS')",[unit,org,campus]);
 for(const [r,code] of [[teacherRole,"TEACHER"],[guardianRole,"SCHOOL_GUARDIAN"],[inspectorRole,"ACADEMIC_INSPECTOR"],[custodianRole,"SCHOOL_CUSTODIAN"]])
   await q("insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,$3,$3,'active')",[r,org,code]);
 for(const [a,r,u] of [[teacherAssignment,teacherRole,teacher],[guardianAssignment,guardianRole,guardian],[observerAssignment,inspectorRole,observer]])
   await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",[a,r,u,campus,null]);
 await q("insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,'SCHOOL_CUSTODIAN','Custodian','active')",[otherCustodianRole,otherOrg]);
 await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,null,null,'active')",[id(33),custodianRole,guardian]);
 await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,null,null,'active')",[id(34),otherCustodianRole,other]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Mathematics Teacher',$4,'active')",[staffId,org,teacher,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Guardian',$4,'active')",[id(41),org,guardian,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Inspector',$4,'active')",[id(42),org,observer,campus]);
 await q("insert into khpos_ops_academic_terms(id,organisation_id,campus_id,start_date,end_date,status) values($1,$2,$3,current_date-30,current_date+30,'active')",[term,org,campus]);
 await q("insert into khpos_ops_academic_delivery_streams(id,organisation_id,term_id,campus_id,unit_id,class_label,subject_label,teacher_assignment_id,status) values($1,$2,$3,$4,$5,'JSS1','Mathematics',$6,'active')",[stream,org,term,campus,unit,teacherAssignment]);
 await fail("select public.khpos_ops_presence_workspace_server($1,$2)",[teacher,otherOrg],/membership/i);
 const before=await read(guardian);
 assert.equal(before.pilotEnabled,false);checks++;
 assert.equal((await read(other,otherOrg)).pilotEnabled,false);checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'pilot_enable',$3)",[teacher,org,{enabled:true}],/Custodian/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_in',$3)",[teacher,org,{campusId:campus}],/pilot is disabled/i);
 await act(guardian,"pilot_enable",{enabled:true});checks++;
 assert.equal((await read(guardian)).pilotEnabled,true);checks++;
 assert.equal((await read(other,otherOrg)).pilotEnabled,false);checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_in',$3)",[teacher,org,{campusId:otherCampus}],/authorised/i);
 await act(teacher,"school_in",{campusId:campus});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_in',$3)",[teacher,org,{campusId:campus}],/already recorded/i);
 const day=(await q("select extract(isodow from (clock_timestamp() at time zone 'Africa/Lagos'))::integer as dow"))[0].dow;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",[teacher,org,{streamId:stream,weekday:day,start:"00:01",end:"23:59"}],/authorised/i);
 await act(guardian,"period_add",{streamId:stream,weekday:day,start:"00:01",end:"23:59",room:"Maths Room"});checks++;
 const ws=await read(teacher);assert.equal(ws.periods.length,1);checks++;
 const periodId=ws.periods[0].id;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",[guardian,org,{streamId:stream,weekday:day,start:"08:00",end:"09:00"}],/overlapping/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'class_in',$3)",[observer,org,{periodId}],/assigned active subject teacher/i);
 await act(teacher,"class_in",{periodId});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_out',$3)",[teacher,org,{}],/Finish the active class/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_disable',$3)",[guardian,org,{periodId}],/Reconcile the open class/i);
 await act(teacher,"class_out",{periodId,outcome:"completed",topic:"Fractions"});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_reconcile',$3)",[teacher,org,{presenceId:ws.todayPresence.id,reason:"A detailed and verified explanation"}],/Guardian/i);
 await act(teacher,"school_out",{});checks++;
 await act(guardian,"hqls_enable",{enabled:true});checks++;
 const strong=[
  "awakening","exploration","micro_illumination","first_trial",
  "full_illumination","second_trial","integration","teacher_role_fidelity"
 ].map((code)=>({code,score:code==="awakening"?2:3,evidence:"Students attempted the problem and explained their own thinking in groups.",automaticFailure:code==="awakening"}));
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_create',$3)",
   [teacher,org,{streamId:stream,observationMode:"full",requestKey:id(100),domains:strong,strengths:"Students considered different ideas."}],/authorised/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_create',$3)",
   [observer,org,{streamId:stream,observationMode:"full",requestKey:id(101),domains:strong.slice(1),strengths:"Students considered different ideas."}],/all eight/i);
 await act(observer,"hqls_create",{streamId:stream,observationMode:"full",requestKey:id(100),domains:strong,strengths:"Students considered different ideas."});checks++;
 await act(observer,"hqls_create",{streamId:stream,observationMode:"full",requestKey:id(100),domains:strong,strengths:"Students considered different ideas."});checks++;
 const h=await read(teacher);assert.equal(h.observations.length,1);checks++;
 assert.equal(h.observations[0].total,23);assert.equal(h.observations[0].band,"model");assert.equal(h.observations[0].automaticFailure,true);
 assert.ok(h.observations[0].coachingWorkId);checks++;
 assert.equal((await q("select count(*)::int as n from khpos_ops_work_items where owner_assignment_id=$1",[teacherAssignment]))[0].n,1);checks++;
 const observationId=h.observations[0].id;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_acknowledge',$3)",[observer,org,{observationId,teacherResponse:"I stepped in too early during exploration."}],/only the observed teacher/i);
 await act(teacher,"hqls_acknowledge",{observationId,teacherResponse:"At Exploration I wanted to correct ideas too quickly."});checks++;
 assert.ok((await read(teacher)).observations[0].acknowledgedAt);checks++;
 await act(observer,"hqls_create",{streamId:stream,observationMode:"walk",requestKey:id(102),domains:[{code:"second_trial",score:2,evidence:"Students revised their original solution in pairs.",automaticFailure:false}],strengths:"Second trial enabled progress."});checks++;
 const observations=(await read(teacher)).observations;
 assert.equal(observations[0].total,null);assert.equal(observations[0].band,null);checks++;
 const observerWorkspace=await read(observer);assert.ok(observerWorkspace.observations.length>=2);checks++;
 await act(other,"pilot_enable",{enabled:true},otherOrg);checks++;
 assert.equal((await read(other,otherOrg)).pilotEnabled,true);checks++;
 assert.equal((await read(guardian)).pilotEnabled,true);checks++;
 await act(guardian,"pilot_enable",{enabled:false});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_create',$3)",[observer,org,{streamId:stream,observationMode:"walk",requestKey:id(103),domains:strong.slice(0,1),strengths:"Observed limited evidence."}],/pilot is disabled/i);
 assert.equal((await read(other,otherOrg)).pilotEnabled,true);checks++;
 await db.exec(fs.readFileSync("supabase/migrations/20261105122000_assessment_timetable.sql","utf8"));
 const current = Date.now();
 const examDay = new Date(current + 3600000).toISOString().slice(0,10);
 const assessment = (actor, mode, input = {}, school = org) => q(
   "select public.khpos_assessment_timetable_server($1,$2,$3,$4) as result",
   [actor,school,mode,{from:examDay,...input}]
 ).then(rows => rows[0].result);
 const schedule = {streamId:stream,kind:"exam",title:"Maths examination",
   startsAt:new Date(current).toISOString(),endsAt:new Date(current+3600000).toISOString()};
 await assert.rejects(assessment(teacher,"add",schedule), /academic leaders/i);
 const exam = (await assessment(guardian,"add",schedule))[0];
 assert.equal(exam.mine,false);
 assert.equal((await assessment(teacher,"list"))[0].mine,true);
 assert.deepEqual(await assessment(other,"list",{},otherOrg),[]);
 await assert.rejects(assessment(other,"list"), /membership/i);
 await assert.rejects(assessment(guardian,"start",{id:exam.id}), /assigned teacher/i);
 await assert.rejects(assessment(teacher,"submit",{id:exam.id,recipient:"Academic Inspector"}), /earlier steps/i);
 await assessment(teacher,"start",{id:exam.id});
 await assessment(teacher,"finish",{id:exam.id});
 await assessment(teacher,"mark",{id:exam.id});
 await assessment(teacher,"submit",{id:exam.id,recipient:"Academic Inspector"});
 const result = (await assessment(guardian,"list"))[0];
 assert.ok(result.checked_in_at && result.checked_out_at && result.marked_at && result.submitted_at);
 assert.equal(result.submitted_to,"Academic Inspector");

 // Real production RPC definitions and new DB columns: validate unclassified
 // history, explicit group certification and the existing authorisation rules.
 await db.exec(fs.readFileSync("supabase/migrations/20261105143000_edit_timetables.sql","utf8"));
 await db.exec(fs.readFileSync("supabase/migrations/20261110150000_timetable_teaching_groups.sql","utf8"));
 await db.exec(fs.readFileSync("supabase/migrations/20261110150000_timetable_teaching_groups.sql","utf8")); // safe after remote migration history drift
 await act(guardian,"pilot_enable",{enabled:true});
 const oldPeriod=(await read(guardian)).periods.find(p=>p.id===periodId);
 assert.equal(oldPeriod.teachingGroupKind,null,"Existing lesson must remain unclassified");
 assert.equal(oldPeriod.parallelVerified,false);
 const parallelDay=(day%7)+1;
 const biology=id(52), government=id(53);
 await q("insert into khpos_ops_academic_delivery_streams(id,organisation_id,term_id,campus_id,unit_id,class_label,subject_label,teacher_assignment_id,status) values($1,$2,$3,$4,$5,'SS2','Biology',$6,'active')",[biology,org,term,campus,unit,teacherAssignment]);
 await q("insert into khpos_ops_academic_delivery_streams(id,organisation_id,term_id,campus_id,unit_id,class_label,subject_label,teacher_assignment_id,status) values($1,$2,$3,$4,$5,'SS2','Government',$6,'active')",[government,org,term,campus,unit,observerAssignment]);
 const groupFields=(name)=>({teachingGroupKind:"department",teachingGroupLabel:name,
   parallelBlockLabel:"SS2 Monday third period",parallelVerified:true});
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",
   [teacher,org,{streamId:biology,weekday:parallelDay,start:"11:15",end:"12:45",room:"Science Lab",...groupFields("Science")}],/authorised Guardian|Academic Inspector|academic leader/i);
 await act(guardian,"period_add",{streamId:biology,weekday:parallelDay,start:"11:15",end:"12:45",room:"Science Lab",...groupFields("Science")});
 await act(guardian,"period_add",{streamId:government,weekday:parallelDay,start:"11:15",end:"12:45",room:"Arts Room",...groupFields("Arts")});
 const parallel=(await read(guardian)).periods.filter(p=>p.class==="SS2");
 assert.equal(parallel.length,2);
 assert.equal(parallel[0].parallelVerified,true);
 assert.equal(parallel[1].parallelVerified,true);
 assert.equal(parallel[0].parallelVerifiedBy,guardian);
 assert.equal(parallel[0].teachingGroupKind,"department");
 const {transpileModule,ModuleKind,ScriptTarget}=await import("typescript");
 const {runInNewContext}=await import("node:vm");
 const scheduleSource=fs.readFileSync("src/lib/khpos/ops/schedule-assist.ts","utf8");
 const js=transpileModule(scheduleSource,{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2020}}).outputText;
 const exportsObject={};
 runInNewContext(js,{exports:exportsObject});
 const detect=exportsObject.findScheduleCollisions;
 assert.equal(typeof detect,"function");
 assert.equal(detect(parallel).length,0,"Approved distinct groups should not create a false clash");
 assert.equal(detect([parallel[0],{...parallel[1],parallelVerified:false}])[0].severity,"review",
   "Unconfirmed parallel groups remain under review");
 assert.equal(detect([parallel[0],{...parallel[1],teachingGroupLabel:"Science"}])[0].severity,"conflict",
   "Same learner group is a real clash");
 assert.equal(detect([parallel[0],{...parallel[1],room:"Science Lab"}])[0].kind,"room",
   "Room clashes are never bypassed");
 assert.equal(detect([parallel[0],{...parallel[1],teacherUserId:parallel[0].teacherUserId}])[0].kind,"teacher",
   "Teacher clashes are never bypassed");
 assert.equal(detect([{...parallel[0],teachingGroupKind:null},{...parallel[1],teachingGroupKind:null}])[0].severity,"review",
   "Legacy unclassified lessons should require review, not be falsely confirmed");
 assert.equal(detect([{...parallel[0],teachingGroupKind:"whole_class"},parallel[1]])[0].severity,"conflict",
   "Whole-class lessons always overlap learner groups");

 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",
   [guardian,org,{streamId:biology,weekday:parallelDay,start:"11:30",end:"12:30",room:"Another Room",...groupFields("Science B")}],
   /overlapping scheduled class/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",
   [guardian,org,{streamId:biology,weekday:3,start:"13:00",end:"14:00",teachingGroupKind:"department",teachingGroupLabel:"X"}],
   /name the teaching group/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",
   [guardian,org,{streamId:biology,weekday:3,start:"13:00",end:"14:00",
     teachingGroupKind:"department",teachingGroupLabel:"Science",parallelVerified:true}],
   /common parallel block/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_edit',$3)",
   [teacher,org,{periodId:parallel[0].id,weekday:parallelDay,start:"11:15",end:"12:45",room:"Science Lab",...groupFields("Science")}],
   /authorised Guardian|Academic Inspector|academic leader/i);
 // Existing timetable editing still works if an older client omits grouping.
 await act(guardian,"period_edit",{periodId:parallel[0].id,weekday:parallelDay,start:"11:15",end:"12:45",room:"Lab 2"});
 assert.equal((await read(guardian)).periods.find(p=>p.id===parallel[0].id).teachingGroupLabel,"Science");
 console.log("Teaching groups: secure SQL migration, previous periods, parallel blocks and collision rules passed.");

 // Exercise the new migration against the production function definitions.
 const academicSql = fs.readFileSync("supabase/migrations/20260924172154_khpos_ops_o12_academic_delivery.sql", "utf8");
 for (const name of ["public.khpos_ops_create_academic_stream_server", "public.khpos_ops_get_academic_delivery_server"]) {
   const start = academicSql.indexOf("create or replace function " + name + "(");
   assert.ok(start >= 0);
   await db.exec(academicSql.slice(start, academicSql.indexOf("\n$$;", start) + 4));
 }
 await db.exec(`
   create function khpos_private.ops_academic_can_plan(uuid,uuid) returns boolean language sql as $$select false$$;
   alter table khpos_ops_academic_delivery_streams
     alter id set default gen_random_uuid(),
     add section_label text, add subject_code text, add scheme_source text, add scheme_reference text,
     add scheme_version text, add timetable_reference text, add expected_weeks int, add created_by uuid;
   create table khpos_ops_academic_events(organisation_id uuid,term_id uuid,stream_id uuid,actor_user_id uuid,event_type text,to_state text,note text);
 `);
 const sectionalSql = fs.readFileSync("supabase/migrations/20261106190000_sectional_scheduling.sql", "utf8");
 await db.exec(sectionalSql.slice(0, sectionalSql.indexOf("create or replace function public.khpos_assessment_timetable_server")));
 await db.exec(fs.readFileSync("supabase/migrations/20261113120000_sectional_subject_streams.sql", "utf8"));
 const promoter = id(800), promoterRole = id(801), otherUnit = id(802);
 await q("insert into auth.users(id) values($1)",[promoter]);
 await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[org,promoter]);
 await q("insert into khpos_ops_roles(id,organisation_id,code,title) values($1,$2,'SECTIONAL_PROMOTER','Sectional Promoter')",[promoterRole,org]);
 await q("insert into khpos_ops_role_assignments(role_id,user_id,campus_id,unit_id) values($1,$2,$3,$4)",[promoterRole,promoter,campus,unit]);
 await q("insert into khpos_ops_units(id,organisation_id,campus_id,name) values($1,$2,$3,'Other section')",[otherUnit,org,campus]);
 const createStream = "select public.khpos_ops_create_academic_stream_server($1,$2,$3,$4,$5,'JSS1',null,'English',null,$6,'manual','Scheme',null,'Timetable',10) as id";
 await fail(createStream,[teacher,org,term,campus,unit,teacherAssignment],/assigned Sectional Promoter/);
 await fail(createStream,[promoter,org,term,campus,otherUnit,teacherAssignment],/assigned Sectional Promoter/);
 await fail(createStream,[promoter,org,term,otherCampus,unit,teacherAssignment],/assigned Sectional Promoter/);
 const draftId = (await q(createStream,[promoter,org,term,campus,unit,teacherAssignment]))[0].id;
 assert.equal((await q("select status from khpos_ops_academic_delivery_streams where id=$1",[draftId]))[0].status,"draft");
 await assert.rejects(act(promoter,"period_add",{streamId:draftId,weekday:parallelDay,start:"17:00",end:"18:00",...groupFields("English")}),/Approve the Academic Delivery stream/);
 await act(promoter,"period_add",{streamId:stream,weekday:parallelDay,start:"17:00",end:"18:00",teachingGroupKind:"whole_class"});
 assert.ok((await read(promoter)).sectionalScheduleStreamIds.includes(stream));
 await q("update khpos_ops_role_assignments set end_date=current_date-1 where user_id=$1",[promoter]);
 await fail(createStream,[promoter,org,term,campus,unit,teacherAssignment],/assigned Sectional Promoter/);
 assert.deepEqual((await read(promoter)).sectionalScheduleStreamIds,[]);
 await assert.rejects(act(promoter,"period_add",{streamId:stream,weekday:parallelDay,start:"18:00",end:"19:00",teachingGroupKind:"whole_class"}),/authorised academic leader/);
 console.log("Sectional Promoter: scoped stream drafts and approved-stream timetable creation passed.");

 console.log("Assessment timetable: permissions, school isolation and full attendance-to-submission workflow passed.");
 console.log("Teaching presence/HQLS multi-school integration: "+checks+" checks passed.");
} finally {await db.close();}

const { default: ts } = await import("typescript");
const { default: vm } = await import("node:vm");
const presenceExports = {};
const periodId = id(700);
let writeError;
let visibleSession;
let belongsToTeacher = true;
let writes = 0;
const presenceClient = {
  async rpc(name) {
    if (name === "khpos_ops_presence_action_server") {
      writes++;
      return { error: writeError };
    }
    assert.equal(name, "khpos_ops_presence_workspace_server");
    return { data: { localDay: "2026-11-12", periods: [{ id: periodId, teacherUserId: teacher, session: visibleSession }] } };
  },
  from(table) {
    return {
      select() { return this; }, eq() { return this; }, in() { return this; }, lte() { return this; },
      async gte() { return { data: [] }; },
      async maybeSingle() {
        assert.equal(table, "khpos_ops_class_sessions");
        return { data: belongsToTeacher ? { id: visibleSession.id } : null };
      },
    };
  },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/khpos/ops/presence.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: presenceExports,
  require: () => ({ createClient: () => presenceClient }),
  process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only" } },
});
const retry = mode => presenceExports.actOnPresence(org, teacher, mode, { periodId });
writeError = { code: "23505", message: 'duplicate key violates "khpos_one_open_class_per_teacher"' };
visibleSession = { id: id(701), in: "08:00", out: null };
assert.equal((await retry("class_in")).periods[0].session.in, "08:00");
belongsToTeacher = false;
await assert.rejects(retry("class_in"), { status: 409, message: /Finish that class first/ });
belongsToTeacher = true;
visibleSession = null;
await assert.rejects(retry("class_in"), { status: 409, message: /Finish that class first/ });
writeError = { code: "P0001", message: "You do not have an open class session for this period." };
visibleSession = { id: id(701), in: "08:00", out: "10:00", administrativelyClosed: false };
assert.equal((await retry("class_out")).periods[0].session.out, "10:00");
visibleSession.administrativelyClosed = true;
await assert.rejects(retry("class_out"), { status: 409, message: /school leader already closed/ });
assert.equal(writes, 5, "Retry recovery never submits a second write");
console.log("Class attendance retries: existing check-in and check-out recovered; conflicting and administratively closed sessions explained.");
