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
 if(name==='@/components/khpos/SchoolSectionTabs')return {SchoolSectionTabs:'school-tabs'};
 if(name==='@/components/khpos/useActiveNavScroll')return {useActiveNavScroll:()=>({current:null})};
 if(name==='@/lib/supabase/client')return {createBrowserSupabaseClient:()=>null};
 throw new Error(name);
}});
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
const n=exports.navigation;
assert.equal(n.workspaceLinks.length,40);
const primary=[...n.dailyLinks,...n.navigationGroups.flatMap(g=>g.links)];assert.equal(primary.length,20);assert.equal(new Set(primary.map(x=>x.suffix)).size,20);
assert(!n.workspaceLinks.some(x=>x.suffix===""),'School Overview must not appear in More');
assert(n.matchesSearch('/work','Today','school overview'),'Search for old School Overview leads to Today');
for(const link of n.workspaceLinks){const entrance=n.primarySuffix(link.suffix);assert(primary.some(x=>x.suffix===entrance),`Lost ${link.suffix}`);}
assert(n.matchesSearch('/people','Staff','leave'));assert(n.matchesSearch('/potential-development','Learner development','skills'));assert(n.matchesSearch('/availability','Leave & cover','movement permission'));
assert.deepEqual(Array.from(n.navigationGroups,g=>g.title),['Work & approvals','People & gate','Teaching & learners','Care & families','Leadership & schools','Resources & help']);
assert.deepEqual(Array.from(n.dailyLinks,x=>x.suffix),['/work','/teaching-presence','/reports','/announcements']);
let tree=exports.SchoolAreaNavigation({organisationId:'school'});let all=nodes(tree);
let group=all.find(x=>x.type==='school-tabs');
assert.ok(group, 'All grouped school pages must use the shared card-style section tabs');
assert.equal(group.props.title,'Staff & roles');
assert.equal(group.props.selected,'/team');
assert.ok(group.props.tabs.some(x=>x.view==='/people'&&x.href==='/khpos/school/people'), 'Staff section keeps the people workspace');
assert.ok(group.props.tabs.some(x=>x.view==='/team'&&x.href==='/khpos/school/team'), 'Staff section keeps the team workspace');
assert.ok(!group.props.tabs.some(x=>x.view==='/availability'), 'Temporary outing stays in School day, not staff');
assert.ok(!all.some(x=>x.type==='select'), 'Do not switch to a dropdown on mobile');
currentPath='/khpos/school/teaching-presence';tree=exports.SchoolAreaNavigation({organisationId:'school'});all=nodes(tree);
group=all.find(x=>x.type==='school-tabs');
assert.equal(group.props.title,'School day & gate');
assert.equal(group.props.selected,'/teaching-presence');
assert.ok(group.props.tabs.some(x=>x.view==='/availability'&&x.href==='/khpos/school/availability'), 'School day shows movement permission as a card tab');
assert.ok(group.props.tabs.some(x=>x.view==='/visitors'&&x.href==='/khpos/school/visitors'), 'School day shows visitors as a card tab');
assert.ok(!all.some(x=>x.type==='select'), 'No school-area dropdown on phones');
currentPath='/khpos/other/reports';tree=exports.SchoolAreaNavigation({organisationId:'other'});assert(nodes(tree).filter(x=>x.props.href && x.props.href !== '/contact').every(x=>(x.props.href === '/khpos/other' || x.props.href.startsWith('/khpos/other/'))),'Area links preserve school boundaries');
currentPath='/khpos/school/work';tree=exports.SchoolAreaNavigation({organisationId:'school'});assert.equal(tree,null,'Today is the home and must not have a redundant breadcrumb or page-area bar');
currentPath='/khpos/school/people';tree=exports.SchoolAreaNavigation({organisationId:'school'});assert.ok(nodes(tree).some(x=>x.props.href==='/khpos/school/work'),'Other school pages return directly to Today');
assert(!nodes(tree).some(x=>x.props.href==='/khpos/school'),'No breadcrumb links back to the removed overview');
const quick=fs.readFileSync('src/components/khpos/ops/SchoolQuickActions.tsx','utf8');
const outing=fs.readFileSync('src/components/khpos/ops/AvailabilityWorkspace.tsx','utf8');
const presence=fs.readFileSync('src/components/khpos/ops/TeacherPresenceWorkspace.tsx','utf8');
const today=fs.readFileSync('src/components/khpos/ops/MyWorkWorkspace.tsx','utf8');
assert(today.includes('>School workspace</p>') && today.includes('{work.organisation.name}'), 'Today hero must show School workspace above the prominent school name');
assert(!today.includes('School workspace · {work.organisation.name}') && !today.includes('            Today\n          </h1>'), 'Do not repeat Today as the giant school heading');
assert(quick.includes('availability?request=outing') && outing.includes('initialOuting ? "temporary_outing"') && fs.readFileSync('src/app/khpos/[organisationId]/availability/page.tsx','utf8').includes('request === "outing"'),'Movement quick action must open the existing permission form');
assert(quick.includes('teaching-presence?tab=lessons') && presence.includes('useState<Panel>(initialTab)') && fs.readFileSync('src/app/khpos/[organisationId]/teaching-presence/page.tsx','utf8').includes('tab === "lessons"'),'Lesson shortcut must open the lesson tab');
assert(today.indexOf('<AnnouncementsWorkspace organisationId={organisationId} compact />') < today.indexOf('My reports</span>'),'Current announcements appear above My reports');
assert(today.includes('id="today-actions"') && !today.includes('aria-label="Daily shortcuts"'), 'The Today page has one action group and a stable attention destination');
assert(today.includes('reviewCount={verificationItems.length}'), 'Relevant reviews appear in the shared quick-action group');
assert(quick.includes('reviewCount > 0') && quick.includes('Raise an issue'), 'Quick actions preserve issue and review access without duplicated shortcut rows');
const home=fs.readFileSync('src/app/khpos/[organisationId]/page.tsx','utf8');
assert(home.includes('redirect(`/khpos/${organisationId}/work`)'), 'Old school home redirects directly to Today');
const health=fs.readFileSync('src/components/khpos/ops/SchoolHealthSummary.tsx','utf8');
assert(health.includes('School health & improvement') && health.includes('canViewHealthReport'), 'Today preserves role-scoped school diagnostics and improvement details');
assert(health.includes('onToggle') && health.includes('"/report/" + baseline.assessmentId'), 'Health details are lazy while School Health Check reports remain accessible');
assert(today.includes('<SchoolHealthSummary organisationId={organisationId} />'), 'Today contains the only school health and improvement panel');
const account=fs.readFileSync('src/components/account/AccountAccess.tsx','utf8');
assert(account.includes('Open Today') && !account.includes('start from your school overview'), 'School chooser has one direct Today entry');
assert(!account.includes('href={`/khpos/${item.organisationId}`}'), 'Account school chooser must not offer a second overview destination');
const tabSource=fs.readFileSync('src/components/khpos/SchoolSectionTabs.tsx','utf8');
assert(tabSource.includes('tab.href ??'), 'Shared card tabs must support full page URLs as well as consolidated view URLs');
assert(tabSource.includes('tabs.length <= 3 ? " flex-wrap sm:flex-nowrap"'), 'Compact groups must not hide other destinations on mobile');
for(const path of ['src/components/khpos/ops/TeacherPresenceWorkspace.tsx','src/components/khpos/ReportsWorkspace.tsx','src/components/khpos/AnnouncementsWorkspace.tsx']) {
  const source=fs.readFileSync(path,'utf8');
  assert(source.includes('khpos-interface-card'), path+' must use the grouped page card style');
}
const navFiles=['src/components/khpos/SchoolSectionTabs.tsx','src/components/khpos/AdminNav.tsx','src/components/khpos/HqSectionNavigation.tsx','src/components/khpos/KaecHqWorkspace.tsx'];
for(const file of navFiles) assert(fs.readFileSync(file,'utf8').includes('useActiveNavScroll'), file+' must reveal the active destination when navigation overflows');
assert(fs.readFileSync('src/components/khpos/SchoolWorkspaceNav.tsx','utf8').includes('<SchoolSectionTabs'), 'Every grouped school area must reuse the shared card-style section controls');
assert(fs.readFileSync('src/components/khpos/useActiveNavScroll.ts','utf8').includes('row.scrollLeft +='), 'All page families must use the shared active-tab scroll behaviour');
assert(fs.readFileSync('src/app/globals.css','utf8').includes('--color-brand-700: #0f4fd8;'),'Existing KHP-OS brand colour must remain');
const consolidated = {
 '/announcements':['meetings','ideas'],
 '/reports':['forms'],
 '/calendar':['events'],
 '/parents':['enquiries'],
 '/priorities':['plan','evidence','reviews','improvement','guides'],
 '/performance':['campuses','compare','learning','development','brief']
};
for (const [route,views] of Object.entries(consolidated)) {
 const content=fs.readFileSync('src/app/khpos/[organisationId]'+route+'/page.tsx','utf8');
 assert(content.includes('SchoolSectionTabs'), route+' must expose a single, tabbed work area');
 for(const view of views) assert(content.includes('selected === "'+view+'"'), route+' must render '+view+' only when selected');
}
for(const [route,canonical,view] of [
 ['meetings','announcements','meetings'],['ideas','announcements','ideas'],
 ['records','reports','forms'],['events','calendar','events'],
 ['parent-journeys','parents','enquiries'],['implementation','priorities','plan'],
 ['evidence','priorities','evidence'],['reviews','priorities','reviews'],
 ['improvement','priorities','improvement'],['playbooks','priorities','guides'],
 ['network-pulse','performance','campuses'],['benchmarking','performance','compare'],
 ['learning-intelligence','performance','learning'],['human-potential-intelligence','performance','development'],
 ['leadership-brief','performance','brief']
]) {
 const content=fs.readFileSync('src/app/khpos/[organisationId]/'+route+'/page.tsx','utf8');
 assert(content.includes('redirectLegacySchoolWorkspace(organisationId, "'+canonical+'", "'+view+'"'), route+' must redirect to existing work area preserving query');
}
const redirects=fs.readFileSync('src/lib/khpos/redirect-legacy-workspace.ts','utf8');
assert(redirects.includes('UUID_RE.test(organisationId)') && redirects.includes('search') && redirects.includes('query.set(key, text)'), 'Legacy bookmarks and meeting links must keep school-scoped query values');
assert(n.matchesSearch('/announcements','Updates','private meetings') && n.matchesSearch('/calendar','Calendar','events') && n.matchesSearch('/priorities','School improvement','action plan'), 'Page search must find formerly separate workflows');
const hqCollab=fs.readFileSync('src/app/khpos/hq/meetings/page.tsx','utf8');
const hqIdeasLegacy=fs.readFileSync('src/app/khpos/hq/ideas/page.tsx','utf8');
const hqNav=fs.readFileSync('src/components/khpos/HqSectionNavigation.tsx','utf8');
assert(hqCollab.includes('HqMeetings') && hqCollab.includes('IdeasBoard') && hqCollab.includes('view === "ideas"'), 'Corporate meetings and discussions must share one context');
assert(hqIdeasLegacy.includes('redirect("/khpos/hq/meetings?view=ideas")'), 'Old HQ discussion links must redirect safely');
assert(!hqNav.includes('{ href: "/khpos/hq/ideas"'), 'HQ navigation must not duplicate discussions');
console.log('Simpler experience passed: 56 compatible school routes, 40 user-facing workspaces, 15 safe school redirects, one unified HQ collaboration area and secure school-scoped links.');
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
