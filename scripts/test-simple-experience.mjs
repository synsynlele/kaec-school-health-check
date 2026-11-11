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
 if(name==='next/image')return {default:'img'};
 if(name==='lucide-react')return new Proxy({},{get:()=> 'span'});
 if(name==='@/components/khpos/NotificationBell')return {NotificationBell:'button'};
 if(name==='@/lib/supabase/client')return {createBrowserSupabaseClient:()=>null};
 throw new Error(name);
}});
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
const n=exports.navigation;
assert.equal(n.workspaceLinks.length,56);
const primary=[...n.dailyLinks,...n.navigationGroups.flatMap(g=>g.links)];assert.equal(primary.length,21);assert.equal(new Set(primary.map(x=>x.suffix)).size,21);
for(const link of n.workspaceLinks){const entrance=n.primarySuffix(link.suffix);assert(primary.some(x=>x.suffix===entrance),`Lost ${link.suffix}`);}
assert(n.matchesSearch('/people','Staff','leave'));assert(n.matchesSearch('/potential-development','Learner development','skills'));assert(n.matchesSearch('/availability','Leave & cover','movement permission'));
let tree=exports.SchoolAreaNavigation({organisationId:'school'});let all=nodes(tree);
assert.equal(all.find(x=>x.type==='select').props.value,'/team');
assert.ok(all.some(x=>x.type==='option'&&x.props.value==='/people'), 'Staff & roles includes the Staff page in the compact selector');
assert.ok(all.some(x=>x.type==='option'&&x.props.value==='/team'), 'Staff & roles keeps Roles & sections reachable');
assert.equal(all.find(x=>x.type==='select').props.value,'/team', 'Current staff page remains selected');
all.find(x=>x.type==='select').props.onChange({target:{value:'/availability'}});assert.deepEqual(pushes,['/khpos/school/availability']);
currentPath='/khpos/other/reports';tree=exports.SchoolAreaNavigation({organisationId:'other'});assert(nodes(tree).filter(x=>x.props.href && x.props.href !== '/contact').every(x=>(x.props.href === '/khpos/other' || x.props.href.startsWith('/khpos/other/'))),'Area links preserve school boundaries');
currentPath='/khpos/school/work';tree=exports.SchoolAreaNavigation({organisationId:'school'});assert.equal(nodes(tree).some(x=>x.type==='select'),false,'Today has no extra area menu');assert.ok(nodes(tree).some(x=>x.props.href==='/khpos/school'),'Today includes a school overview breadcrumb');
const quick=fs.readFileSync('src/components/khpos/ops/SchoolQuickActions.tsx','utf8');
const outing=fs.readFileSync('src/components/khpos/ops/AvailabilityWorkspace.tsx','utf8');
const presence=fs.readFileSync('src/components/khpos/ops/TeacherPresenceWorkspace.tsx','utf8');
const today=fs.readFileSync('src/components/khpos/ops/MyWorkWorkspace.tsx','utf8');
assert(quick.includes('availability?request=outing') && outing.includes('initialOuting ? "temporary_outing"') && fs.readFileSync('src/app/khpos/[organisationId]/availability/page.tsx','utf8').includes('request === "outing"'),'Movement quick action must open the existing permission form');
assert(quick.includes('teaching-presence?tab=lessons') && presence.includes('useState<Panel>(initialTab)') && fs.readFileSync('src/app/khpos/[organisationId]/teaching-presence/page.tsx','utf8').includes('tab === "lessons"'),'Lesson shortcut must open the lesson tab');
assert(today.indexOf('<AnnouncementsWorkspace organisationId={organisationId} compact />') < today.indexOf('My reports</span>'),'Current announcements appear above My reports');
assert(fs.readFileSync('src/app/globals.css','utf8').includes('--color-brand-700: #0f4fd8;'),'Existing KHP-OS brand colour must remain');
console.log('Simpler experience passed: 56 preserved routes, 21 unique entrances, linked school-day actions, branded UI, secure school-scoped links and accessible page search.');
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

const appHelp={};
vm.runInNewContext(compile('src/lib/khpos/ops/app-help.ts'),{exports:appHelp});
const assistant={};
vm.runInNewContext(compile('src/lib/khpos/ops/assistant.ts')+'\nexports.detectIntent=detectIntent; exports.fallbackAnswer=deterministicAnswer;',{
 exports:assistant,process:{env:{}},
 require:(name)=>name==='@/lib/khpos/ops/app-help'?appHelp:{},
});
assert.equal(assistant.detectIntent('Are school tasks being completed on time?'),'performance','Plain-English results question must reach the scoped performance service');
assert.equal(assistant.detectIntent('Show school results'),'performance');
assert.equal(assistant.detectIntent('What tasks do I have today?'),'work');
assert.equal(assistant.detectIntent('Which policy applies?'),'policy');
assert.equal(assistant.detectIntent('Which approvals are waiting?'),'decision');
assert.match(assistant.fallbackAnswer('Help','general',[]),/information your role can access/);
console.log('Ask KHP-OS language passed: familiar results wording reaches the correct scoped service; task, policy and approval routing remain intact.');
