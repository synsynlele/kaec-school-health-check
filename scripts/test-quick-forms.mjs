import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const load=(file)=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>{throw Error('unexpected runtime import');}});return exports;};
const quick=load('src/lib/khpos/quick-forms.ts'),hq=load('src/lib/khpos/hq-quick-report.ts');
const db=new PGlite();
try{
 await db.exec('create schema khpos_private;create role anon;create role authenticated;create table kaec_hq_reporting_submissions(id uuid);');
 await db.exec(fs.readFileSync('supabase/migrations/20261027062518_quick_report_forms.sql','utf8'));
 const validate=async(fields,payload=null)=>db.query('select khpos_private.report_validate_fields($1,$2)',[fields,payload]);
 const fields=[{key:'help',label:'Need help?',type:'boolean',required:true},{key:'why',label:'What help?',type:'textarea',required:true,showWhen:{key:'help',value:true}},{key:'areas',label:'Work areas',type:'multiselect',required:true,options:['Teaching','Other','None this period']},{key:'other',label:'Other work',type:'text',required:true,showWhen:{key:'areas',value:'Other'}}];
 await validate(fields,{help:false,areas:['Teaching']});
 await assert.rejects(()=>validate(fields,{help:true,areas:['Teaching']}),/required field/);
 await assert.rejects(()=>validate(fields,{help:'No',areas:['Teaching']}),/Yes or No/);
 await assert.rejects(()=>validate(fields,{help:false,why:'stale hidden answer',areas:['Teaching']}),/hidden/);
 await validate(fields,{help:true,why:'Cover needed',areas:['Other'],other:'An agreed project'});
 await assert.rejects(()=>validate(fields,{help:false,areas:['Other']}),/required field/);
 await assert.rejects(()=>validate(fields,{help:false,areas:['Teaching','Teaching']}),/distinct/);
 await assert.rejects(()=>validate(fields,{help:false,areas:['Forged option']}),/available/);
 await assert.rejects(()=>validate(fields,{help:false,areas:'Teaching'}),/list/);
 await assert.rejects(()=>validate(fields,{help:false,areas:[]}),/required/);
 await assert.rejects(()=>validate(fields,{help:false,areas:['Teaching','None this period']}),/either/);
 await assert.rejects(()=>validate(fields,{help:false,areas:['Teaching'],foreign:'private'}),/outside/);
 await assert.rejects(()=>validate([{...fields[0],showWhen:{key:'help',value:true}}]),/earlier/);
 await assert.rejects(()=>validate([fields[0],{...fields[1],showWhen:{key:'help',value:'true'}}]),/Yes\/No/);
 await assert.rejects(()=>validate([{...fields[2]},{...fields[3],showWhen:{key:'areas',value:'invalid'}}]),/valid/);
 // A chain of follow-ups cannot remain required when its ancestor is hidden.
 await validate([fields[0],{key:'choice',label:'Which?',type:'select',required:true,options:['A'],showWhen:{key:'help',value:true}},{key:'details',label:'Details',type:'text',required:true,showWhen:{key:'choice',value:'A'}}],{help:false});
 await validate([{key:'summary',label:'Original report',type:'textarea',required:true}],{summary:'Existing report stays readable'});
 const input={help:false,why:'stale',areas:['Teaching'],other:'stale'};
 assert.equal(JSON.stringify(quick.visibleReportPayload(fields,input)),JSON.stringify({help:false,areas:['Teaching']}));
 assert.equal(input.why,'stale'); // projection does not mutate edit buffer.
 for(const template of quick.quickReportTemplates)await validate(template.fields);
 const grants=await db.query("select has_function_privilege('anon','khpos_private.report_validate_fields(jsonb,jsonb)','execute') as allowed");assert.equal(grants.rows[0].allowed,false);
 const valid={progress:'Completed as planned',areas:['Planning or review'],help:'No',followUp:'No'};
 const output=hq.hqQuickContents(valid,'','','');assert.match(output.achievements,/Reported work status/);assert.match(output.next_actions,/Reporter selected/);
 assert.throws(()=>hq.hqQuickContents({...valid,help:'Yes'},'','',''),/Explain/);
 assert.throws(()=>hq.hqQuickContents({...valid,followUp:'Yes'},'','',''),/next action/);
 assert.throws(()=>hq.hqQuickContents({...valid,areas:['Other']},'','',''),/other work/);
 assert.throws(()=>hq.hqQuickContents({...valid,areas:['No work this period']},'','',''),/do not agree/);
 assert.throws(()=>hq.hqQuickContents({...valid,areas:['Forged']},'','',''),/valid answer/);
 console.log('Quick forms: real SQL validation, conditional required fields, privacy projection, legacy compatibility and HQ server rules passed.');
}finally{await db.close();}
// Exercise the actual accessible choice component and its interaction callbacks.
const jsx=await import('react/jsx-runtime');
const choiceExports={};let identity=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/khpos/TapChoices.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:choiceExports,require(name){if(name==='react/jsx-runtime')return jsx;if(name==='react')return {useId:()=>`choice-${++identity}`};throw Error(name);}});
const nodes=n=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]:[];
let picked;
const render=props=>choiceExports.TapChoices({label:'Work areas',options:['Teaching','Other','None this period'],onChange:v=>picked=v,...props});
let tree=render({multiple:true,value:['Teaching']});
let inputs=nodes(tree).filter(n=>n.type==='input');assert.equal(inputs[0].props.checked,true);inputs[2].props.onChange();assert.equal(JSON.stringify(picked),'["None this period"]');
tree=render({multiple:true,value:['None this period']});inputs=nodes(tree).filter(n=>n.type==='input');inputs[0].props.onChange();assert.equal(JSON.stringify(picked),'["Teaching"]');
tree=render({value:undefined,required:true});inputs=nodes(tree).filter(n=>n.type==='input');assert(inputs.every(n=>!n.props.checked));assert(inputs.every(n=>n.props.type==='radio'));assert.equal(new Set(inputs.map(n=>n.props.name)).size,1);
inputs[1].props.onChange();assert.equal(picked,'Other');assert.equal(nodes(render({disabled:true}))[0].props.disabled,true);
console.log('Choice controls passed: no assumed answers, native radio groups, multiple selection and exclusive none answers.');
