import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
function load(path, overrides={}) {
  const testModule={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const nativeRequire=createRequire(import.meta.url);
  new Function('require','module','exports',code)((name)=>overrides[name] ?? nativeRequire(name),testModule,testModule.exports);
  return testModule.exports;
}
const {recommendKhposExecution,draftKhposExecutionRecommendation}=load('src/lib/khpos/ops/execution-recommendations.ts');
const source={code:'ACD-002',criticality:'P0',version:{version:2,trigger:'Before a new academic term.',sla:'Before delivery begins',escalation:['Gap to School Guardian'],evidence:['Approved plan']},owners:[{id:'academic-role',title:'Academic Inspector',staffed:true}],recurring:[],roles:[],current:{evidenceRequired:false,verificationRequired:true}};
const original=JSON.stringify(source);
let result=recommendKhposExecution(source);
assert.equal(JSON.stringify(source),original);
assert.equal(result.mode,'manual_on_demand','Term planning is not an ongoing control or an invented automatic event');
assert.equal(result.ownerRoleId,'academic-role');assert.equal(result.triggerSummary,source.version.trigger);assert.equal(result.approvedVersion,2);
assert.equal(result.escalationBasis,'proposed_interval');assert.equal(result.escalationMinutes,30);
assert.equal(result.evidenceRequired,true);assert.equal(result.verificationRequired,true);
const current={processId:'process',mode:'continuous_control',ownerRoleId:'saved-role',dueOffsetMinutes:240,evidenceRequired:true,verificationRequired:true,kpiCodes:['KPI-1']};
const before=JSON.stringify(current);const draft=draftKhposExecutionRecommendation(current,result);
assert.equal(JSON.stringify(current),before);assert.equal(draft.dueOffsetMinutes,240);assert.deepEqual(draft.kpiCodes,['KPI-1']);assert.equal(draft.verificationRequired,true);
result=recommendKhposExecution({...source,owners:[...source.owners,{id:'other',title:'Other',staffed:true}]});assert.equal(result.ownerRoleId,null,'Never guess among governed owners');
assert.equal(draftKhposExecutionRecommendation(current,result).ownerRoleId,'saved-role','Retain reviewed choice when recommendation is ambiguous');
result=recommendKhposExecution({...source,owners:[{...source.owners[0],staffed:false}]});assert.equal(result.ownerStaffed,false);assert(result.cautions.some(x=>x.includes('no active school member')));
result=recommendKhposExecution({...source,code:'GOV-007',version:{...source.version,trigger:'A policy reaches its review date.'}});assert.equal(result.mode,'condition');assert.equal(result.conditionKey,'policy_review_due');
for(const [code,trigger,event] of [['ACD-007','Missed delivery','academic_recovery_required'],['PEO-009','Unplanned absence','staff_coverage_required'],['LPI-003','Risk signal recorded','learner_support_required'],['OPS-007','Asset maintenance issue','asset_fault_reported']]) {result=recommendKhposExecution({...source,code,version:{...source.version,trigger}});assert.equal(result.eventType,event);assert.equal(result.mode,'event');}
result=recommendKhposExecution({...source,code:'ACD-007',version:{...source.version,trigger:'Custom unrelated trigger'}});assert.equal(result.mode,'manual_on_demand','Code alone must not invent an automatic route');
result=recommendKhposExecution({...source,recurring:[{ownerRoleId:'scheduled-owner',cadence:'weekly'}],roles:[{id:'scheduled-owner',title:'Schedule Owner',staffed:true}]});assert.equal(result.mode,'recurring');assert.equal(result.ownerRoleId,'scheduled-owner');
result=recommendKhposExecution({...source,version:{...source.version,escalation:['Escalate within 2 hours to School Guardian']}});assert.equal(result.escalationMinutes,120);assert.equal(result.escalationBasis,'approved_interval');
result=recommendKhposExecution({...source,version:{...source.version,escalation:['Escalate within 2 hours','Escalate after 30 minutes']}});assert.equal(result.escalationMinutes,null);assert.equal(result.escalationBasis,'requires_review');
result=recommendKhposExecution({...source,version:{...source.version,escalation:['Escalate within 2 working hours']}});assert.equal(result.escalationBasis,'proposed_interval');
const {khposRecordHref,focusKhposRecord}=load('src/lib/khpos/ops/record-links.ts');
const id='11111111-1111-4111-8111-111111111111';
assert.equal(khposRecordHref('school','verification',id),`/khpos/school/work#verification-${id}`);
assert.equal(khposRecordHref('school','issue',id),`/khpos/school/issues#issue-${id}`);
let scrolled=false,focused=false,lookups=0;
const documentRoot={getElementById:anchor=>{lookups++;assert.equal(anchor,`work-${id}`);return {scrollIntoView:()=>scrolled=true,focus:()=>focused=true};}};
assert.equal(focusKhposRecord(`#work-${id}`,documentRoot),true);assert(scrolled&&focused);
assert.equal(focusKhposRecord('#arbitrary-selector',documentRoot),false);assert.equal(lookups,1);
assert.equal(focusKhposRecord(`#issue-${id}`,{getElementById:()=>null}),false,'No fetching or revealing unauthorised records');
// Exercise the real snapshot service against a bounded, multi-school query adapter.
const organisation={id:'school',name:'Fixture school',status:'active',partner_status:'active',partner_entitlements:['khpos_core']};
const ownerRole={id:'owner',organisation_id:'school',code:'TEACHER',title:'Teacher',role_level:20,status:'active'};
const leadershipRole={id:'leader',organisation_id:'school',code:'SCHOOL_GUARDIAN',title:'School Guardian',role_level:90,status:'active'};
const processRow={id:'own-process',organisation_id:'school',code:'ACD-002',title:'Term Academic Planning',criticality:'P0',owner_label:'Teacher',operating_system:'academic',status:'active'};
const versionRow={process_id:'own-process',status:'active',version:1,trigger:'Before a new term',sla:null,escalation:[],evidence:[],khpos_ops_processes:{organisation_id:'school'}};
const otherSchools=Array.from({length:1100},(_,i)=>({process_id:'other-'+i,status:'active',khpos_ops_processes:{organisation_id:'other-school'},role_id:'other-owner',participation:'owner'}));
const tables={
  organisations:[organisation],
  organisation_memberships:[{organisation_id:'school',user_id:'actor',status:'active',role:'admin',organisations:organisation},{organisation_id:'school',user_id:'ended-owner',status:'inactive',role:'staff',organisations:organisation}],
  khpos_ops_roles:[ownerRole,leadershipRole],
  khpos_ops_role_assignments:[{role_id:'leader',user_id:'actor',status:'active'},{role_id:'owner',user_id:'ended-owner',status:'active'}],
  khpos_ops_processes:[processRow],
  khpos_ops_process_versions:[...otherSchools,versionRow],
  khpos_ops_process_roles:[...otherSchools,{process_id:'own-process',role_id:'owner',participation:'owner',khpos_ops_processes:{organisation_id:'school'}}],
  khpos_ops_process_execution_profiles:[{id:'profile',organisation_id:'school',process_id:'own-process',activation_mode:'manual_on_demand',owner_role_id:null,event_type:null,condition_key:null,trigger_summary:null,due_offset_minutes:null,evidence_required:true,verification_required:true,escalation_minutes:null,kpi_codes:[],status:'needs_mapping'}],
  khpos_ops_recurring_rules:[],khpos_ops_process_tool_requirements:[],khpos_ops_trigger_events:[],
};
const getField=(row,field)=>field.split('.').reduce((value,key)=>value?.[key],row);
const adapter={from(table){
  let rows=tables[table] ?? [];
  const query={
    select(){return query;},
    eq(field,value){rows=rows.filter(row=>getField(row,field)===value);return query;},
    neq(field,value){rows=rows.filter(row=>getField(row,field)!==value);return query;},
    in(field,values){rows=rows.filter(row=>values.includes(getField(row,field)));return query;},
    gte(field,value){rows=rows.filter(row=>getField(row,field)>=value);return query;},
    order(){return query;},
    maybeSingle(){return Promise.resolve({data:rows[0] ?? null,error:null});},
    then(resolve,reject){return Promise.resolve({data:rows.slice(0,1000),error:null}).then(resolve,reject);},
  };return query;
}};
const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-fixture';
const service=load('src/lib/khpos/ops/execution.ts',{'@supabase/supabase-js':{createClient:()=>adapter},'@/lib/khpos/ops/execution-recommendations':{recommendKhposExecution}});
if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
const snapshot=await service.getKhposExecutionSnapshot('school','actor');
assert.equal(snapshot.items.length,1,'Other schools must not crowd out this school through the API row limit');
assert.equal(snapshot.items[0].recommendation.ownerRoleId,'owner','Governed owner participation must also survive the school filter');
assert.equal(snapshot.items[0].recommendation.ownerStaffed,false,'An active assignment with inactive school membership is not staffed');
assert.equal(snapshot.items[0].blockedByMissingAssignment,true);
await assert.rejects(service.getKhposExecutionSnapshot('school','ended-owner'),error=>error.status===403,'Inactive membership must not read recommendations');
await assert.rejects(service.configureKhposExecution('school','actor',{processId:'own-process',mode:'manual_on_demand',dueOffsetMinutes:0.5}),error=>error.status===400&&error.message.includes('whole number'));
console.log('Execution guidance: approved sources, safe owners, controls, intervals, authorised DOM focus, multi-school row limits and inactive membership passed.');
