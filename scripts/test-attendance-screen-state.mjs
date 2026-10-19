import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
const nowMs=Date.parse("2026-10-19T07:45:00Z");
class ClockDate extends Date { constructor(...args){super(...(args.length?args:[nowMs]));} static now(){return nowMs;} }
const compile=path=>ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const guidance={},gateModule={};
vm.runInNewContext(compile("src/lib/khpos/ops/attendance-guidance.ts"),{exports:guidance,Intl,Date:ClockDate});
vm.runInNewContext(compile("src/lib/khpos/ops/attendance-refresh.ts"),{exports:gateModule});
const gate=gateModule.createAttendanceRefreshGate(),old=gate.startRead();
assert(gate.beginWrite());assert.equal(gate.startRead(),null);assert.equal(gate.beginWrite(),false);assert.equal(gate.canApplyRead(old),false);
gate.finishWrite();assert.equal(gate.canApplyRead(old),false);const recent=gate.startRead();assert(gate.canApplyRead(recent));
const refs=[],states=[];let cursor=0,refCursor=0,load,latest,delayed=null;
let snapshot={localDay:guidance.lagosLocalDay(nowMs),userId:"teacher",pilotEnabled:true,
 staff:{id:"staff",name:"Teacher Example",campusId:"campus"},campuses:[{id:"campus",name:"Campus"}],todayPresence:null,
 periods:[],observations:[],teamPresence:[],openClassSessions:[],openSchoolAttendance:[]};
const client={auth:{getSession:async()=>({data:{session:{access_token:"test"}}})}};
let requests=0;
async function fetch(_url,options){
 requests++;
 if(options.method==="POST"){
  const body=JSON.parse(options.body);assert.equal(body.location.status,"captured");
  snapshot={...snapshot,todayPresence:body.mode==="school_in"?{id:"presence",campusId:"campus",in:new Date().toISOString(),out:null}: {...snapshot.todayPresence,out:new Date().toISOString()}};
  return {ok:true,json:async()=>({ok:true,workspace:snapshot})};
 }
 const value=snapshot;
 if(delayed)return delayed.then(()=>({ok:true,json:async()=>({ok:true,workspace:value})}));
 return {ok:true,json:async()=>({ok:true,workspace:value})};
}
const exports={};
vm.runInNewContext(compile("src/components/khpos/ops/TodayAttendanceCard.tsx"),{exports,fetch,Date:ClockDate,Intl,window:{confirm:()=>true},require(name){
 if(name==="react/jsx-runtime")return jsx;
 if(name==="react")return {useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==="function"?initial():initial;return [states[i],value=>{states[i]=typeof value==="function"?value(states[i]):value;}];},useRef(initial){const i=refCursor++;return refs[i]??=( {current:initial});},useMemo:f=>f(),useCallback:f=>{load=f;return f;},useEffect:()=>{}};
 if(name==="next/link")return {default:"a"};
 if(name==="lucide-react")return new Proxy({},{get:()=>"span"});
 if(name==="@/lib/supabase/client")return {createBrowserSupabaseClient:()=>client};
 if(name==="@/lib/khpos/ops/action-events")return {announceKhposActivityChanged:()=>{},KHPOS_ACTIVITY_CHANGED:"changed"};
 if(name==="@/lib/khpos/ops/attendance-guidance")return guidance;
 if(name==="@/lib/khpos/ops/attendance-refresh")return gateModule;
 if(name==="@/components/khpos/useAttendanceLocation")return {useAttendanceLocation:()=>({capture:async()=>({status:"captured",latitude:6.55,longitude:3.25,accuracy:5}),dialog:null})};
 if(name==="@/components/khpos/AttendanceLocationEvidence")return {AttendanceLocationEvidence:"div"};
 throw new Error(name);
}});
function render(){cursor=0;refCursor=0;latest=exports.TodayAttendanceCard({organisationId:"school"});return latest;}
function nodes(node){if(!node||typeof node!=="object")return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
const rows=tree=>nodes(tree).filter(x=>typeof x.type==="function"&&x.type.name==="AttendanceRow");
render();await load();let tree=render();
assert(rows(tree).some(n=>n.props.step.kind==="school_in"));assert(!rows(tree).some(n=>n.props.step.kind==="school_out"));
assert(nodes(tree).some(n=>[n.props?.children].flat(Infinity).includes("Teacher Example")),"Staff identity is visibly rendered");
let release;delayed=new Promise(r=>{release=r;});const staleLoad=load();await Promise.resolve();await Promise.resolve();
await rows(tree).find(n=>n.props.step.kind==="school_in").props.onRecord("school_in",null);
release();await staleLoad;delayed=null;tree=render();
assert.equal(rows(tree).filter(n=>n.props.step.kind==="school_in").length,0,"Arrival action disappears immediately and cannot be restored by a stale read");
assert(rows(tree).some(n=>n.props.step.kind==="school_out"),"Departure replaces arrival");
await rows(tree).find(n=>n.props.step.kind==="school_out").props.onRecord("school_out",null);tree=render();
assert.equal(rows(tree).filter(n=>n.props.step.kind.startsWith("school")).length,0,"No school action remains after departure");
assert(nodes(tree).some(n=>n.props?.children==="School attendance completed"));
assert.equal(requests,4);
console.log("Attendance screen lifecycle passed: staff name, arrival→departure→completed, location in quick actions, write lock and delayed stale GET rejection.");
