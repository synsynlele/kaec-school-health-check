import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
let state=[],cursor=0,saved;
const compiled=ts.transpileModule(fs.readFileSync("src/components/khpos/ReportsWorkspace.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
class FormValues { get(key){return {title:"Class teacher report",instructions:"Class progress",owner:"teacher-role",reviewer:"reviewer-role",start:"2026-10-19",end:"",dueDays:"1",dueTime:"17:00",note:"Restrict to appointed class teachers"}[key]??"";} }
vm.runInNewContext(compiled+"\nexports.TypeEditor=TypeEditor;",{exports,Date,FormData:FormValues,require(name){
 if(name==="react/jsx-runtime")return jsx;
 if(name==="react")return {useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==="function"?initial():initial;return [state[i],v=>{state[i]=typeof v==="function"?v(state[i]):v;}];},useRef:x=>({current:x}),useCallback:f=>f,useEffect:()=>{}};
 if(name==="./TapChoices")return {TapChoices:()=>null};
 if(name==="@/lib/khpos/quick-forms") {const mod={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/khpos/quick-forms.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod});return mod;}
 if(name==="next/link")return {default:"a"};
 if(name==="@/lib/supabase/client")return {};
 if(name==="@/lib/khpos/ops/action-events")return {};
 throw new Error(name);
}});
const type={id:"type",version:3,title:"Class teacher report",fields:[{key:"summary",label:"Summary",type:"textarea",required:true}],cadence:"daily",owner_role_id:"teacher-role",reviewer_role_id:"reviewer-role",audience_mode:"selected",audience_assignment_ids:[],campus_id:"campus",unit_id:null,start_date:"2026-10-19",interval_days:14,due_days:1,due_time:"17:00",status:"paused"};
const workspace={scopes:[{campusId:"campus",unitId:null,label:"Campus"}],roles:[{id:"teacher-role",title:"Teacher"},{id:"reviewer-role",title:"Guardian"}],recipients:[{id:"class-teacher",roleId:"teacher-role",campusId:"campus",unitId:null,label:"Selected class teacher"},{id:"subject-teacher",roleId:"teacher-role",campusId:"campus",unitId:null,label:"Subject-only teacher"},{id:"other-campus",roleId:"teacher-role",campusId:"other",unitId:null,label:"Other campus"}]};
const props={type,workspace,busy:false,onSave:async input=>{saved=input;return true;},onCancel:()=>{}};
function nodes(n){return !n||typeof n!=="object"?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
function render(){cursor=0;return exports.TypeEditor(props);}
let tree=render();const save=tree=>nodes(tree).find(n=>n.type==="button"&&n.props.children==="Save report type");
assert.equal(save(tree).props.disabled,true,"Empty selected audience cannot be saved");
const recipientGroup=nodes(tree).find(n=>n.type==="fieldset"&&nodes(n).some(c=>c.type==="legend"&&c.props.children==="Select the actual submitters"));
const checkboxes=nodes(recipientGroup).filter(n=>n.type==="input"&&n.props.type==="checkbox");assert.equal(checkboxes.length,2,"Recipient choices follow role and campus scope");
checkboxes[0].props.onChange({target:{checked:true}});tree=render();assert.equal(save(tree).props.disabled,false);
tree.props.onSubmit({preventDefault(){},currentTarget:{}});
assert.equal(saved.audienceMode,"selected");assert.deepEqual(Array.from(saved.audienceAssignmentIds),["class-teacher"]);
assert(!saved.audienceAssignmentIds.includes("subject-teacher"));
console.log("Report audience UI passed: explicit named recipients, campus filtering, empty-selection guard and selected-only save payload.");
