import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  school,
  otherSchool,
  campus,
  campus2,
  otherCampus,
  unit,
  unit2,
  owner,
  guardian,
  promoter,
  teacher,
  peer,
  outsider,
  admin,
  ownerRole,
  guardRole,
  promoterRole,
  teacherRole,
] = Array.from({ length: 18 }, (_, i) => id(i + 1));
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const act = async (actor, org, mode, input) =>
  (
    await q("select khpos_report_action_server($1,$2,$3,$4) as id", [
      actor,
      org,
      mode,
      input,
    ])
  )[0].id;
const feed = async (actor, org, report = null, status = "", offset = 0) =>
  (
    await q(
      `select khpos_reports_workspace_server($1,$2,'',$3,$4,$5) as data`,
      [actor, org, status, offset, report],
    )
  )[0].data;
try {
  await db.exec(
    "create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);",
  );
  await db.exec(
    fs.readFileSync("scripts/fixtures/staff-positions-schema.sql", "utf8"),
  );
  await db.exec(
    "create table public.khpos_platform_admins(user_id uuid,status text,platform_role text);",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261016085446_staff_announcements.sql",
      "utf8",
    ),
  );
  for (const o of [school, otherSchool])
    await q(
      "insert into organisations(id,name,status,partner_status) values($1,$2,'active','active')",
      [o, o === school ? "School A" : "School B"],
    );
  for (const u of [owner, guardian, promoter, teacher, peer, outsider, admin]) {
    await q("insert into auth.users values($1)", [u]);
    if (u !== admin)
      await q(
        "insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",
        [u === outsider ? otherSchool : school, u],
      );
  }
  await q(
    "insert into khpos_platform_admins values($1,'active','super_admin')",
    [admin],
  );
  for (const [c, o] of [
    [campus, school],
    [campus2, school],
    [otherCampus, otherSchool],
  ])
    await q(
      "insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,$3,'active')",
      [c, o, c],
    );
  for (const [u, c] of [
    [unit, campus],
    [unit2, campus],
  ])
    await q(
      "insert into khpos_ops_units(id,organisation_id,campus_id,name,status) values($1,$2,$3,$4,'active')",
      [u, school, c, u],
    );
  for (const [r, code] of [
    [ownerRole, "SCHOOL_CUSTODIAN"],
    [guardRole, "SCHOOL_GUARDIAN"],
    [promoterRole, "SECTIONAL_PROMOTER"],
    [teacherRole, "TEACHER"],
  ])
    await q(
      "insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,$3,$3,'active')",
      [r, school, code],
    );
  await q(
    "insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,'TEACHER','Teacher','active')",
    [id(50), otherSchool],
  );
  for (const [u, r, c, s] of [
    [owner, ownerRole, null, null],
    [guardian, guardRole, campus, null],
    [promoter, promoterRole, campus, unit],
    [teacher, teacherRole, campus, unit],
    [peer, teacherRole, campus, unit2],
    [outsider, id(50), otherCampus, null],
  ]) {
    await q(
      "insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",
      [id(100 + Number(u.slice(-3))), r, u, c, s],
    );
    if (u !== owner)
      await q(
        "insert into khpos_ops_staff(id,organisation_id,user_id,display_name,status,campus_id,unit_id) values($1,$2,$3,$4,'active',$5,$6)",
        [
          id(200 + Number(u.slice(-3))),
          u === outsider ? otherSchool : school,
          u,
          "Staff " + u.slice(-3),
          c,
          s,
        ],
      );
  }
  await db.exec(
    "create table khpos_ops_academic_terms(id uuid primary key,organisation_id uuid,campus_id uuid,start_date date,end_date date,status text);",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261016155432_reporting_centre.sql",
      "utf8",
    ),
  );
  const date = (
    await q("select (now() at time zone 'Africa/Lagos')::date::text as d")
  )[0].d;
  const fields = [
    { key: "summary", label: "Summary", type: "textarea", required: true },
    { key: "number", label: "Count", type: "number", required: true },
    { key: "confirmed", label: "Confirmed", type: "boolean", required: true },
    {
      key: "choice",
      label: "Choice",
      type: "select",
      required: true,
      options: ["A", "B"],
    },
  ];
  const type = {
    title: "Daily teaching report",
    instructions: "Record results and next actions.",
    ownerRoleId: teacherRole,
    reviewerRoleId: guardRole,
    cadence: "daily",
    startDate: date,
    endDate: "",
    dueDays: 7,
    dueTime: "17:00",
    fields,
    campusId: campus,
    unitId: null,
    intervalDays: 14,
  };
  const answers = {
    summary: "Teaching delivered; next steps agreed.",
    number: 3,
    confirmed: false,
    choice: "A",
  };
  await assert.rejects(
    act(teacher, school, "type_save", type),
    /cannot manage/,
  );
  await assert.rejects(
    act(guardian, school, "type_save", { ...type, campusId: null }),
    /cannot manage/,
  );
  await assert.rejects(
    act(owner, otherSchool, "type_save", type),
    /membership/,
  );
  await assert.rejects(
    act(owner, school, "type_save", { ...type, campusId: otherCampus }),
    /campus/,
  );
  await assert.rejects(
    act(owner, school, "type_save", { ...type, reviewerRoleId: id(50) }),
    /active school roles/,
  );

  await db.exec(fs.readFileSync("supabase/migrations/20261019165907_report_audience_privacy.sql","utf8"));
  // Stub only the extension API; run the full deployment migration against the fixture.
  await db.exec(`create schema cron;
    create table cron.job(jobid bigint,jobname text,schedule text,active boolean,command text);
    insert into cron.job values(7,'khpos-daily-push-reminders','*/30 5-16 * * 1-6',true,'preserved authenticated endpoint');
    create function cron.alter_job(bigint,schedule text) returns void language sql as $$update cron.job set schedule=$2 where jobid=$1$$;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261022174503_report_prompt_delivery.sql","utf8"));
  const job=(await q("select * from cron.job"))[0];
  assert.equal(job.schedule,"*/5 5-16 * * 1-6");
  assert.equal(job.jobid,7);assert.equal(job.command,"preserved authenticated endpoint");
  const teacherAssignment=id(100+Number(teacher.slice(-3))),peerAssignment=id(100+Number(peer.slice(-3)));
  const inbox=async(actor,report=null)=> (await q("select khpos_reports_workspace_server($1,$2,'','reviewer:',0,$3) data",[actor,school,report]))[0].data;
  const attention=async(actor)=>(await q("select khpos_report_attention_server($1,$2) data",[actor,school]))[0].data;
  const typeId=await act(owner,school,"type_save",type);
  let report=(await feed(teacher,school)).items[0];
  const ready = (await attention(teacher)).items;
  assert.ok(ready.some(n => n.id === report.id), "Assigned report appears before its deadline reminder window");
  assert.equal(ready.find(n => n.id === report.id).title, report.title);
  assert.equal(ready.find(n => n.id === report.id).period_start, report.period_start);
  const peerReport=(await feed(peer,school)).items[0];
  assert.equal((await feed(guardian,school)).items.length,0,"Personal view excludes peer reports even for reviewers");
  assert.equal((await inbox(guardian)).items.length,0,"Reviewer cannot read any unsubmitted drafts");
  assert.equal((await inbox(guardian,report.id)).items.length,0,"Draft ID lookup cannot bypass privacy");
  assert.equal((await feed(peer,school,report.id)).items.length,0);
  assert.deepEqual((await feed(peer,school,report.id)).history,[]);
  assert.deepEqual((await feed(teacher,school)).recipients,[],"Teacher cannot fetch the school's recipient directory");
  await act(teacher,school,"save",{id:report.id,lockVersion:report.lock_version,payload:{summary:"Private unsent draft"}});
  assert.equal((await inbox(guardian,report.id)).items.length,0,"Saved draft answers remain private");
  report=(await feed(teacher,school,report.id)).items[0];
  await act(teacher,school,"submit",{id:report.id,lockVersion:report.lock_version,payload:answers});
  assert.equal((await inbox(guardian)).items.length,1);assert.equal((await inbox(guardian)).items[0].isMine,false);
  assert.equal((await feed(guardian,school)).items.length,0);
  let submitted=(await inbox(guardian,report.id)).items[0];
  await act(guardian,school,"return",{id:report.id,lockVersion:submitted.lock_version,note:"Please add class progress"});
  let returned=(await feed(teacher,school,report.id)).items[0];
  await act(teacher,school,"save",{id:report.id,lockVersion:returned.lock_version,payload:{summary:"Private correction in progress"}});
  assert.equal((await inbox(guardian,report.id)).items.length,0,"Returned report corrections remain private until resubmitted");
  returned=(await feed(teacher,school,report.id)).items[0];
  await act(teacher,school,"submit",{id:report.id,lockVersion:returned.lock_version,payload:answers});
  const change=async(ids,mode="selected")=>{
    const t=(await feed(owner,school)).types.find(t=>t.id===typeId);
    return act(owner,school,"type_save",{...type,id:typeId,version:t.version,audienceMode:mode,audienceAssignmentIds:ids,note:"Restrict to actual class teachers"});
  };
  await assert.rejects(change([]),/at least one/);
  await assert.rejects(change([id(100+Number(outsider.slice(-3)))]),/Selected staff/);
  await change([teacherAssignment]);
  assert.equal((await feed(peer,school)).items.length,0,"Removed staff see no unsubmitted obligation");
  assert.equal((await feed(peer,school)).types.some(t=>t.id===typeId),false,"Removed staff see no template");
  assert.equal((await attention(peer)).summary.open,0,"Removed staff receive no report reminders");
  await assert.rejects(act(peer,school,"submit",{id:peerReport.id,lockVersion:peerReport.lock_version,payload:answers}),/current report owner/);
  await change([peerAssignment]);
  const oldHistory=(await feed(teacher,school,report.id)).items[0];assert(oldHistory);assert.equal(oldHistory.canEdit,false,"Prior author retains submitted history but cannot edit outside the audience");
  assert.equal((await feed(peer,school)).items.length,1);
  let n=(await feed(peer,school)).items[0];await act(peer,school,"submit",{id:n.id,lockVersion:n.lock_version,payload:answers});
  // A teacher with a second reviewer role gets peer content only in the reviewer view after submission.
  await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,status) values($1,$2,$3,$4,'active')",[id(500),guardRole,teacher,campus]);
  assert.equal((await feed(teacher,school)).items.length,1);
  assert.equal((await feed(teacher,school)).items[0].owner_user_id,teacher);
  const review=(await inbox(teacher)).items;assert.equal(review.length,1);assert.equal(review[0].owner_user_id,peer);assert.equal(review[0].canReview,true);
  await assert.rejects(act(teacher,school,"accept",{id:report.id,lockVersion:oldHistory.lock_version}),/designated reviewer/);
  const foreign=(await feed(outsider,otherSchool,report.id));assert.equal(foreign.items.length,0);assert.deepEqual(foreign.history,[]);
  const available=(await feed(owner,school)).recipients;assert(available.some(a=>a.id===teacherAssignment));assert(!available.some(a=>a.id===id(100+Number(outsider.slice(-3)))));
  const oneOff=await act(owner,school,"type_save",{...type,title:"Class-only event report",cadence:"one_off",audienceMode:"selected",audienceAssignmentIds:[peerAssignment]});
  await assert.rejects(act(teacher,school,"create",{typeId:oneOff,assignmentId:teacherAssignment,periodStart:date,periodEnd:date}),/not available/);
  await act(peer,school,"create",{typeId:oneOff,assignmentId:peerAssignment,periodStart:date,periodEnd:date});
  await q("update khpos_report_types set status='paused',audience_mode='selected',audience_assignment_ids='{}' where id=$1",[typeId]);
  const paused=(await feed(owner,school)).types.find(t=>t.id===typeId);
  await assert.rejects(act(owner,school,"type_status",{id:typeId,version:paused.version,status:"active",note:"Resume class teacher reporting"}),/Select the intended staff/);
  const privileges=(await q("select has_function_privilege('anon','public.khpos_reports_workspace_server(uuid,uuid,text,text,integer,uuid,uuid,date,date)','execute') anon,has_function_privilege('authenticated','public.khpos_report_action_server(uuid,uuid,text,jsonb)','execute') client"))[0];assert.deepEqual(privileges,{anon:false,client:false});
  console.log("Report audience/privacy passed: selected recipients, recurring/one-off assignment gates, hidden unassigned drafts/templates/reminders, submitted-history preservation, draft privacy, separate multi-role review inbox, cross-school ID/history denial and service-only RPCs.");
} catch(e) { console.error(e.message,e.where??""); process.exitCode=1; } finally { await db.close(); }
