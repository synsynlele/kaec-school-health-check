import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
function load(path) {
  const testModule={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(createRequire(import.meta.url),testModule,testModule.exports);
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
for(const [name,kind] of [['MyWorkWorkspace','work'],['IssuesWorkspace','issue'],['DecisionsWorkspace','decision']]) {const ui=fs.readFileSync(`src/components/khpos/ops/${name}.tsx`,'utf8');assert(ui.includes('useRecordFocus('));assert(ui.includes(`khposRecordAnchor("${kind}"`));}
console.log('Execution recommendations and Today navigation: approved sources, safe owner selection, controls, intervals, exact record links and authorised DOM focus passed.');
