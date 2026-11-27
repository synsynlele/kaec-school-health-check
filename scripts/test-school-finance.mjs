import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const db = new PGlite({ extensions: { btree_gist } });
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const [school, second, campus, otherCampus, foreignCampus, officer, owner, teacher, classId, term] = Array.from({length:10}, (_, i) => id(i + 1));
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema khpos_private;
create table auth.users(id uuid primary key);
create table public.organisations(id uuid primary key,name text,status text,partner_status text,partner_entitlements text[]);
create table public.organisation_memberships(organisation_id uuid,user_id uuid,status text);
create table public.khpos_ops_campuses(id uuid primary key,organisation_id uuid,name text,status text);
create table public.khpos_ops_roles(id uuid primary key,organisation_id uuid,code text,status text);
create table public.khpos_ops_role_assignments(role_id uuid,user_id uuid,campus_id uuid,unit_id uuid,status text,start_date date,end_date date);
create table public.khpos_class_subject_catalog(id uuid primary key,organisation_id uuid,campus_id uuid,label text,section text,available boolean);
create table public.khpos_ops_academic_terms(id uuid primary key,organisation_id uuid,campus_id uuid,term_name text,session_label text,start_date date,end_date date,status text);
create table public.khpos_ops_learner_anchors(id uuid primary key default gen_random_uuid(),organisation_id uuid,campus_id uuid,external_system text,
 external_learner_reference text,display_name text,class_label text,section_label text,status text,created_by uuid,updated_at timestamptz);
insert into auth.users values ('${officer}'),('${owner}'),('${teacher}');
insert into organisations values ('${school}','Igando Test School','active','active',array['khpos_core']),
 ('${second}','Other School','active','active',array['khpos_core']);
insert into organisation_memberships values ('${school}','${officer}','active'),('${school}','${owner}','active'),('${school}','${teacher}','active');
insert into khpos_ops_campuses values ('${campus}','${school}','Igando','active'),('${otherCampus}','${school}','Amuwo','active'),('${foreignCampus}','${second}','Other','active');
insert into khpos_ops_roles values ('${id(11)}','${school}','FINANCE_ADMIN_OFFICER','active'),('${id(12)}','${school}','SCHOOL_CUSTODIAN','active'),
 ('${id(13)}','${school}','TEACHER','active');
insert into khpos_ops_role_assignments values ('${id(11)}','${officer}','${campus}',null,'active','2020-01-01',null),
 ('${id(12)}','${owner}',null,null,'active','2020-01-01',null),('${id(13)}','${teacher}',null,null,'active','2020-01-01',null);
insert into khpos_class_subject_catalog values ('${classId}','${school}','${campus}','JSS 1','A',true);
insert into khpos_ops_academic_terms values ('${term}','${school}',null,'First term','2025/26','2025-09-01','2025-12-31','closed');
insert into khpos_ops_learner_anchors(id,organisation_id,campus_id,external_system,external_learner_reference,display_name,class_label,section_label,status)
 values('${id(14)}','${school}','${campus}','SIS','KAEC-014','Dara Adeyemi','JSS 1','A','active');
`);
const migrate = name => db.exec(readFileSync(new URL("../supabase/migrations/" + name + ".sql", import.meta.url), "utf8"));
await migrate("20261121190000_school_finance_register");
async function call(surface, action, input = {}, actor = officer, org = school, scope = campus) {
  const result = await db.query(`select khpos_finance_${surface}_server($1,$2,$3,$4,$5) as result`, [actor,org,scope,action,JSON.stringify(input)]);
  return result.rows[0].result;
}
const register = (...args) => call("register", ...args);
const student = {admission:"KAEC-015",name:"Iremide Bello", class:"JSS 1",arm:"A",term};
assert.equal((await register("context")).campuses.length,1);
assert.equal((await register("context",{},owner)).campuses.length,2);
await assert.rejects(register("learners",{},teacher), /appointment/);
await assert.rejects(register("learners",{},owner,second,foreignCampus), /appointment/);
await assert.rejects(register("learners",{},officer,school,otherCampus), /appointment/);
assert.equal((await register("saveLearner", {...student,admission:"kaec-014",name:"Dara Adeyemi"})).id,id(14));
const learner = (await register("saveLearner",student)).id;
const imported = await register("importLearners", { rows:[student,{...student,admission:"KAEC-016",class:"SS 9"},{...student,admission:"KAEC-016",name:"Kemi Obi"}] });
assert.deepEqual(imported.map(row=>row.result),["already registered","error","saved"]);
assert.equal((await register("learners",{search:"iremide"}))[0].id, learner);
await db.exec("set role authenticated");
await assert.rejects(db.query("select * from khpos_finance_learners"), /permission denied/);
await assert.rejects(register("context"), /permission denied/);
await db.exec("reset role");
console.log("Phase 1: learner linking, batch imports, appointment scopes and direct access denial passed");

await migrate("20261121191000_school_finance_ledger");
const [period, cash, bank] = [id(21), id(22), id(23)];
await db.exec(`insert into khpos_finance_periods values ('${period}','${school}','${campus}','${term}','2025-09-01','2025-12-31',false);
 insert into khpos_finance_accounts values ('${cash}','${school}','${campus}','Office cash','cash','2025-09-01',0),
 ('${bank}','${school}','${campus}','School bank','bank','2025-09-01',0);`);
async function ledgerFunction(method,action,item) {
  return (await db.query(`select khpos_private.finance_${method}($1,$2,$3,p,$4,$5) as result from khpos_finance_periods p where id=$6`,
    [officer,school,campus,JSON.stringify(item),action,period])).rows[0].result;
}
const date = "2025-10-01";
const schedule = (await ledgerFunction("billing","saveSchedule",{class:classId,label:"Tuition",amount:7000000,due:"2025-10-31"})).id;
assert.equal((await ledgerFunction("billing","billSchedule",{schedule,date})).created, 3);
const invoice = (await db.query("select id from khpos_finance_invoices where learner_id=$1",[learner])).rows[0].id;
const payment = {invoice,amount:8000000,reference:"TELLER-001",account:bank,date};
const paid=await ledgerFunction("post","payment",payment);
assert.equal(paid.allocated,7000000);
await assert.rejects(ledgerFunction("post","payment",payment),/duplicate/);
await ledgerFunction("post","refund",{original:paid.id,amount:1500000,reference:"REFUND-001",date});
function value(fn,args) {
  return db.query(`select khpos_private.${fn}(${args.map((_,i)=>"$"+(i+1)).join(",")}) as val`,args).then(x=>Number(x.rows[0].val));
}
assert.equal(await value("finance_invoice_balance",[invoice]),500000);
assert.equal(await value("finance_learner_credit",[school,campus,learner]),0);
await ledgerFunction("post","scholarship",{invoice,amount:200000,reference:"AWARD-001",date});
assert.equal(await value("finance_invoice_balance",[invoice]),300000);
const later = await ledgerFunction("billing","saveSchedule",{class:classId,label:"Tuition",amount:7500000,due:"2025-11-30"});
assert.equal(later.version,2);
assert.equal((await ledgerFunction("billing","billSchedule",{schedule:later.id,date})).created,0);
assert.equal(await value("finance_invoice_balance",[invoice]),300000);
console.log("Phase 2: class billing, safe rebilling, partial balances, overpayments, refunds and scholarships passed");

await migrate("20261121192000_school_finance_operations");
const ledger=(...args)=>call("ledger",...args);
const txn=(n, fields)=>({period,key:id(n),date,...fields});
assert.equal((await ledger("periods"))[0].id, period);
assert.equal((await ledger("invoices",{period,search:"iremide"}))[0].balance, 300000);
const expense = txn(30,{kind:"expense",account:bank,amount:500000,reference:"BILL-001",category:"Electricity"});
assert.deepEqual(await ledger("post",expense),await ledger("post",expense));
await assert.rejects(ledger("post",{...expense,amount:600000}),/identifier is already in use/);
await ledger("post",txn(31,{kind:"transfer",account:bank,destination:cash,amount:200000,reference:"TRANSFER-001"}));
await ledger("post",txn(32,{kind:"income",account:cash,amount:300000,reference:"DONATION-001",category:"Donations"}));
assert.equal((await ledger("accounts")).find(x=>x.id===bank).balance,5800000);
const openingFile={period,date,rows:[{admission:"KAEC-015",kind:"credit",amount:"40000"},{admission:"BAD",kind:"credit",amount:"500"}]};
assert.deepEqual((await ledger("previewOpening",openingFile)).map(x=>x.result),["ready","error"]);
const opening=(await ledger("importOpening",openingFile))[0];
assert.equal(opening.result,"awaiting review");
assert.equal((await ledger("importOpening",openingFile))[0].result,"already recorded or awaiting review");
await ledger("approveRequest",txn(75,{id:opening.id,note:"Historical balance verified"}),owner);
assert.equal(await value("finance_learner_credit",[school,campus,learner]),40000);
const adjustment=await ledger("post",txn(33,{kind:"discount",amount:100000,invoice,reference:"DISC-01",note:"Sibling discount requested"}));
assert.equal(adjustment.pending,true);
await assert.rejects(ledger("approveRequest",txn(34,{id:adjustment.id,note:"I checked the policy"})),/does not permit/);
await ledger("approveRequest",txn(35,{id:adjustment.id,note:"Matches school policy"},),owner);
assert.equal(await value("finance_invoice_balance",[invoice]),200000);
await assert.rejects(ledger("setThreshold",txn(71,{amount:"200000"})),/does not permit/);
await ledger("setThreshold",txn(72,{amount:"200000"}),owner);
const high=await ledger("post",txn(73,{...expense,key:id(73),reference:"EXP-REVIEW",note:"Verify vendor invoice"}));
assert.equal(high.pending,true);
assert.equal((await ledger("entries",{period})).some(entry=>entry.reference==="EXP-REVIEW"),false);
await ledger("returnRequest",txn(74,{id:high.id,note:"Awaiting additional receipt"}),owner);
const reconciled=txn(36,{account:bank,balance:5800000,date:"2025-12-31",reference:"DEC-STATEMENT",confirmed:true});
await assert.rejects(ledger("reconcile",{...reconciled,balance:0}),/differs/);
await ledger("reconcile",reconciled);
await ledger("reconcile",txn(37,{account:cash,balance:500000,date:"2025-12-31",reference:"DEC-CASH-COUNT",confirmed:true}));
await assert.rejects(ledger("post",txn(38,{kind:"payment",account:bank,amount:5000,invoice,reference:"BACKDATED-1"})),/already reconciled/);
assert.equal((await ledger("entries",{period})).find(x=>x.reference==="TRANSFER-001").reconciled,true);
console.log("Phase 3: idempotency, Custodian review, transfers, reconciliation and backdate safeguards passed");

await db.exec("create schema extensions");
await migrate("20261119112500_school_financial_health");
await migrate("20261121193000_school_finance_reporting");
const report=(...args)=>call("report",...args);
const obligation=await report("addObligation",txn(77,{description:"Electricity invoice",due:"2025-10-02",amount:500000}));
assert.equal((await report("obligations",{period}))[0].status,"open");
await assert.rejects(report("settleObligation",txn(78,{id:obligation.id,reference:"BAD"})),/exact amount/);
await report("settleObligation",txn(79,{id:obligation.id,reference:"BILL-001"}));
assert.equal((await report("obligations",{period}))[0].status,"paid");
await report("saveBudget",txn(40,{category:"Electricity",amount:400000}));
assert.equal((await report("budget",{period}))[0].spent,500000);
const overview=await report("overview",{period});
assert.equal(overview.received,6800000);
assert.equal(overview.cash,6300000);
assert.equal(overview.expenses,500000);
assert.equal(overview.reconciliationComplete,true);
assert.equal(overview.overdueLearners,3);
assert.equal((await report("aged",{period})).length,3);
await assert.rejects(report("prepareStatement",txn(41,{})),/appointment/);
await assert.rejects(report("prepareStatement",txn(42,{}),owner),/each|every active campus/);
await ledger("closePeriod",txn(43,{note:"Period ledger reviewed"}),owner);
const branchPeriod=(await ledger("openPeriod",{key:id(44),term},owner,school,otherCampus)).id;
await ledger("closePeriod",{period:branchPeriod,key:id(45),note:"No activity at Amuwo"},owner,school,otherCampus);
const formal=await report("prepareStatement",txn(46,{}),owner);
assert.equal((await report("source",{period},owner)).status,"draft");
await assert.rejects(db.query("update khpos_school_financial_periods set fee_income=1 where id=$1",[formal.id]),/reconciled ledger snapshot/);
await db.query("update khpos_school_financial_periods set status='submitted',updated_by=$2 where id=$1",[formal.id,officer]);
assert.equal((await report("attention",{},owner)).statements,1);
await db.query("update khpos_school_financial_periods set status='approved',approved_by=$2,approved_at=now(),updated_by=$2 where id=$1",[formal.id,owner]);
assert.equal((await report("source",{period},owner)).status,"approved");
await assert.rejects(ledger("reopenPeriod",txn(47,{note:"Needs later correction"}),owner),/frozen/);
assert.equal((await report("annual",{period})).feeReceipts,6500000);
console.log("Phase 4: budget variance, cash and aged-debt figures, reconciled snapshots, and period locking passed");

await db.exec("create schema storage; create table storage.buckets(id text,name text,public boolean,file_size_limit int,allowed_mime_types text[]); create table storage.objects(bucket_id text);");
await migrate("20261121194000_school_finance_documents");
const document = (actor,scope,entry,path=null,mime=null) => db.query(
  "select khpos_finance_document_server($1,$2,$3,$4,$5,$6) as result",[actor,school,scope,entry,path,mime]
).then(r=>r.rows[0].result);
const objectPath=school+"/"+campus+"/"+paid.id+"/"+id(50);
await assert.rejects(document(teacher,campus,paid.id),/appointment/);
await assert.rejects(document(owner,otherCampus,paid.id),/not found/);
await assert.rejects(document(officer,campus,paid.id,"untrusted/path","image/png"),/supported document/);
assert.equal((await document(officer,campus,paid.id,objectPath,"image/png")).path,objectPath);
assert.equal((await document(owner,campus,paid.id)).mime,"image/png");
await assert.rejects(document(officer,campus,paid.id,objectPath,"image/png"),/duplicate/);
assert.deepEqual(await report("attention",{},teacher),{adjustments:0,statements:0});
const { default: ts } = await import("typescript");
const shared = ts.transpileModule(readFileSync(new URL("../src/lib/khpos/ops/school-finance-shared.ts",import.meta.url),"utf8"),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020},
}).outputText;
const { currency,toKobo,financeWarnings } = await import("data:text/javascript;base64,"+Buffer.from(shared).toString("base64"));
assert.equal(toKobo("0.01"),"1");
assert.equal(toKobo("70000.05"),"7000005");
assert.equal(currency("7000005"),"₦70,000.05");
assert.throws(()=>toKobo("1.005"),/two decimal/);
assert(financeWarnings(overview).some(message=>message.includes("Electricity expenses are above budget")));
assert(financeWarnings({entries:0,due:0}).some(message=>message.includes("collection rate is unavailable")));
console.log("Phase 5: financial rules, exact naira conversions, role-aware attention and private evidence passed");
const {rows: protectedTables} = await db.query("select relname,relrowsecurity, has_table_privilege('authenticated',oid,'SELECT') as allowed from pg_class where relname like 'khpos_finance_%' and relkind='r'");
assert(protectedTables.length>=13);
assert(protectedTables.every(table=>table.relrowsecurity&&!table.allowed));
await db.exec("set role service_role");
assert.equal((await register("context")).school,"Igando Test School");
await assert.rejects(db.query("select * from khpos_finance_entries"),/permission denied/);
await db.exec("reset role");

const guardian = id(87);
await db.exec(`
  insert into auth.users values ('${guardian}');
  insert into organisation_memberships values ('${school}','${guardian}','active');
  insert into khpos_ops_roles values ('${id(88)}','${school}','SCHOOL_GUARDIAN','active');
  insert into khpos_ops_role_assignments values ('${id(88)}','${guardian}','${campus}',null,'active','2020-01-01',null);
`);
await migrate("20261127140000_finance_guardian_oversight");
const oversight = (action, input = {}, actor = guardian, org = school, scope = campus) => call("oversight",action,input,actor,org,scope);
assert.deepEqual((await register("context",{},guardian)).campuses,[{id:campus,name:"Igando",canApprove:false,canManage:false}]);
assert.equal((await register("context",{},officer)).campuses[0].canManage,true);
assert.equal((await oversight("periods"))[0].id,period);
const guardianSummary = await oversight("summary",{period});
assert.equal(guardianSummary.expenses,overview.expenses);
assert.equal(guardianSummary.budget,400000);
assert.equal(guardianSummary.balance,overview.balance);
assert.deepEqual(Object.keys(guardianSummary).sort(),["from","through","invoiced","feeReceipts","balance","overdue","otherIncome","expenses","budget"].sort());
await assert.rejects(oversight("periods",{},guardian,school,otherCampus),/appointment/);
await assert.rejects(oversight("summary",{period},guardian,second,foreignCampus),/appointment/);
await assert.rejects(oversight("periods",{},teacher),/appointment/);
await assert.rejects(oversight("saveBudget",{period}),/oversight report/);
await assert.rejects(call("report","aged",{period},guardian),/appointment/);
await assert.rejects(call("report","saveBudget",{period},guardian),/appointment/);
await assert.rejects(call("ledger","post",{period},guardian),/appointment/);
await assert.rejects(call("ledger","approveRequest",{period},guardian),/appointment/);
await assert.rejects(document(guardian,campus,paid.id),/appointment/);
const { rows: [oversightPrivileges] } = await db.query(
  "select has_function_privilege('authenticated','public.khpos_finance_oversight_server(uuid,uuid,uuid,text,jsonb)','execute') as direct, has_function_privilege('service_role','public.khpos_finance_oversight_server(uuid,uuid,uuid,text,jsonb)','execute') as service"
);
assert.deepEqual(oversightPrivileges,{direct:false,service:true});

await migrate("20261128000000_finance_collection_workspace");
await db.query("update khpos_finance_learners set guardian_name=$1 where learner_id=$2",["Finance guardian fixture",learner]);
assert.equal((await register("learners",{search:"GUARDIAN FIXTURE"}))[0].id,learner);
assert.deepEqual(await register("learners",{search:"GUARDIAN FIXTURE"},owner,school,otherCampus),[]);
const learnerAccount = await ledger("statement",{period,learner});
assert.equal(learnerAccount.name,student.name);
assert.equal(learnerAccount.balance,learnerAccount.invoices.reduce((total,row)=>total+Number(row.balance),0));
assert.equal(typeof learnerAccount.latestReceipt,"string");
assert.equal((await ledger("receipt",{period,id:learnerAccount.latestReceipt}))[0].kind,"payment");
assert((await ledger("invoices",{period,learner,includeHistory:true,outstandingOnly:true})).every(row=>Number(row.balance)>0));
await assert.rejects(ledger("statement",{period,learner},guardian),/appointment/);
await db.close();
console.log("Phase 6: finance tables deny direct access and use service-only, role-scoped database operations");
