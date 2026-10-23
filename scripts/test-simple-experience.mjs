import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const language={};vm.runInNewContext(compile('src/lib/khpos/plain-language.ts'),{exports:language});
for(const [code,label] of [['awaiting_verification','Waiting for review'],['manual_on_demand','Start when needed'],['role_charter','Role guide'],['under_review','Being reviewed']])assert.equal(language.plainLabel(code),label);
assert.equal(language.plainLabel('SCHOOL_CUSTODIAN'),'SCHOOL CUSTODIAN','Role identity remains recognisable');
assert.equal(language.plainLabel(null),'Not set');
const pushes=[], effects=[],refs=[],state=[];let currentPath='/khpos/school/team',stateCursor=0,refCursor=0;
const exports={};
vm.runInNewContext(compile('src/components/khpos/SchoolWorkspaceNav.tsx')+'\nexports.navigation={workspaceLinks,dailyLinks,navigationGroups,schoolAreas,matchesSearch,primarySuffix};',{exports,require(name){
 if(name==='react/jsx-runtime')return jsx;
 if(name==='react')return {useState(initial){const i=stateCursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=v];},useRef(initial){const i=refCursor++;return refs[i]??={current:initial};},useEffect:fn=>effects.push(fn)};
 if(name==='next/navigation')return {usePathname:()=>currentPath,useRouter:()=>({push:path=>pushes.push(path)})};
 if(name==='next/link')return {default:'a'};
 if(name==='lucide-react')return new Proxy({},{get:()=> 'span'});
 if(name==='@/components/khpos/NotificationBell')return {NotificationBell:'button'};
 if(name==='@/lib/supabase/client')return {createBrowserSupabaseClient:()=>null};
 throw new Error(name);
}});
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
const n=exports.navigation;
assert.equal(n.workspaceLinks.length,53);
const primary=[...n.dailyLinks,...n.navigationGroups.flatMap(g=>g.links)];assert.equal(primary.length,22);assert.equal(new Set(primary.map(x=>x.suffix)).size,22);
for(const link of n.workspaceLinks){const entrance=n.primarySuffix(link.suffix);assert(primary.some(x=>x.suffix===entrance),`Lost ${link.suffix}`);}
assert(n.matchesSearch('/people','Staff','leave'));assert(n.matchesSearch('/potential-development','Learner development','skills'));
let tree=exports.SchoolAreaNavigation({organisationId:'school'});let all=nodes(tree);
assert.equal(all.find(x=>x.type==='select').props.value,'/team');
assert.ok(all.some(x=>x.props.href==='/khpos/school/people'));
assert.ok(all.some(x=>x.props.href==='/khpos/school/team'&&x.props['aria-current']==='page'));
all.find(x=>x.type==='select').props.onChange({target:{value:'/availability'}});assert.deepEqual(pushes,['/khpos/school/availability']);
currentPath='/khpos/other/reports';tree=exports.SchoolAreaNavigation({organisationId:'other'});assert(nodes(tree).filter(x=>x.props.href).every(x=>x.props.href.startsWith('/khpos/other/')),'Area links preserve school boundaries');
currentPath='/khpos/school/work';assert.equal(exports.SchoolAreaNavigation({organisationId:'school'}),null,'Today has no extra area menu');
console.log('Simpler experience passed: 53 preserved routes, 22 distinct entrances, grouped search, current tab, mobile page switching, school-scoped links and plain display labels.');
// A field must retain its name after placeholder text disappears during typing.
const missing=[];
function auditFields(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=dir+'/'+entry.name;if(entry.isDirectory()){auditFields(file);continue;}if(!file.endsWith('.tsx'))continue;
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const visit=node=>{
  if(ts.isJsxSelfClosingElement(node)&&['input','textarea'].includes(node.tagName.getText(source))){
   const attrs=Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr=>[attr.name.getText(source),attr.initializer]));
   if(attrs.placeholder&&!attrs.id&&!attrs['aria-label']&&!attrs['aria-labelledby']){
    let parent=node.parent,labelled=false;while(parent){if(ts.isJsxElement(parent)&&['label','Field','SelectField'].includes(parent.openingElement.tagName.getText(source))){labelled=true;break;}parent=parent.parent;}
    if(!labelled)missing.push(file+':'+source.getLineAndCharacterOfPosition(node.pos).line);
   }
  }ts.forEachChild(node,visit);
 };visit(source);
}}
auditFields('src/components/khpos');assert.deepEqual(missing,[],'Placeholder text must never be the only field label');
console.log('Form accessibility passed: every placeholder field retains a visible label or an explicit accessible name.');

const assistant={};
vm.runInNewContext(compile('src/lib/khpos/ops/assistant.ts')+'\nexports.detectIntent=detectIntent; exports.fallbackAnswer=deterministicAnswer;',{exports:assistant,process:{env:{}},require:()=>({})});
assert.equal(assistant.detectIntent('Are school tasks being completed on time?'),'performance','Plain-English results question must reach the scoped performance service');
assert.equal(assistant.detectIntent('Show school results'),'performance');
assert.equal(assistant.detectIntent('What tasks do I have today?'),'work');
assert.equal(assistant.detectIntent('Which policy applies?'),'policy');
assert.equal(assistant.detectIntent('Which approvals are waiting?'),'decision');
assert.match(assistant.fallbackAnswer('Help','general',[]),/information your role can access/);
console.log('Ask KHP-OS language passed: familiar results wording reaches the correct scoped service; task, policy and approval routing remain intact.');
