import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const effects=[], timers=[], listeners={}, exports={};
let cursor=0, state=[], requests=0;
const task={id:'owned-report',title:'Weekly class progress',period_start:'2026-10-22',period_end:'2026-10-28',due_at:'2026-10-28T16:00:00Z',status:'draft',canEdit:true,canReview:false};
const workspace={summary:{open:1,overdue:0,review:0},tasks:[task]};
const document={visibilityState:'visible',addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:()=>{}};
const window={location:{search:''},setTimeout:()=>1,clearTimeout:()=>{},setInterval:(fn,ms)=>{timers.push({fn,ms});return 1;},clearInterval:()=>{},addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:()=>{}};
const compiled=ts.transpileModule(fs.readFileSync('src/components/khpos/ReportsWorkspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
class CustomEvent {constructor(type,init){this.type=type;this.detail=init.detail;}}
vm.runInNewContext(compiled,{exports,Date,URLSearchParams,window,document,CustomEvent,fetch:async()=>{requests++;return {ok:true,json:async()=>({workspace})};},require(name){
 if(name==='react/jsx-runtime')return jsx;
 if(name==='react')return {useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef:x=>({current:x}),useCallback:f=>f,useEffect:fn=>effects.push(fn)};
 if(name==='next/link')return {default:'a'};
 if(name==='@/lib/supabase/client')return {createBrowserSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}})};
 if(name==='@/lib/khpos/ops/action-events')return {KHPOS_ACTIVITY_CHANGED:'changed'};
 throw new Error(name);
}});
function nodes(n){return !n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];}
state[0]=workspace;
const tree=exports.ReportsWorkspace({organisationId:'school',compact:true});
const all=nodes(tree);
assert.ok(all.some(n=>n.props.children===task.title),'Today shows actual task title');
assert.ok(all.some(n=>n.props.href==='/khpos/school/reports?report=owned-report'),'Today links directly to the owned report');
assert.ok(all.some(n=>n.props.children==='Complete report'));
for(const effect of effects)effect();
assert.equal(timers[0].ms,30000);
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
timers[0].fn();await settle();assert.equal(requests,1,'Visible app refreshes without navigation');
document.visibilityState='hidden';timers[0].fn();await settle();assert.equal(requests,1,'Hidden app does not poll');
document.visibilityState='visible';listeners.visibilitychange();await settle();assert.equal(requests,2,'Resume refreshes immediately');
listeners.changed(new CustomEvent('changed',{detail:{organisationId:'other-school'}}));await settle();assert.equal(requests,2);
listeners.changed(new CustomEvent('changed',{detail:{organisationId:'school'}}));await settle();assert.equal(requests,3,'Same-school changes refresh Today immediately');
console.log('Report delivery UI: direct tasks, visible 30-second refresh, resume/activity refresh, hidden-tab suppression and school isolation passed.');
