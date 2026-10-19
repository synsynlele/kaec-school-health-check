import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
const source = fs.readFileSync("src/lib/khpos/attendance-location.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function environment(geolocation) {
  const exports = {}, timers = new Map(); let key = 0;
  vm.runInNewContext(compiled, { exports, navigator: { geolocation }, Date,
    setTimeout(fn) { timers.set(++key, fn); return key; }, clearTimeout(id) { timers.delete(id); } });
  return { api: exports, timers };
}
let calls = 0;
const ok = environment({ getCurrentPosition(success, _failure, options) {
  calls++; assert.equal(options.maximumAge, 0); assert.equal(options.enableHighAccuracy, true); assert.equal(options.timeout, 12000);
  success({ coords: { latitude: 6.55, longitude: 3.25, accuracy: 7 }, timestamp: Date.now() });
} });
assert.equal(calls, 0, "No location capture on module load");
const captured = await ok.api.captureAttendanceLocation();
assert.equal(captured.status, "captured"); assert.equal(captured.accuracy, 7); assert.equal(calls, 1); assert.equal(ok.timers.size, 0);
for (const [code, status] of [[1, "denied"], [2, "unavailable"], [3, "timeout"]]) {
  const ctx = environment({ getCurrentPosition(_success, failure) { failure({ code }); } });
  assert.equal((await ctx.api.captureAttendanceLocation()).status, status); assert.equal(ctx.timers.size, 0);
}
assert.equal((await environment(undefined).api.captureAttendanceLocation()).status, "unsupported");
assert.equal((await environment({ getCurrentPosition() { throw new Error("blocked"); } }).api.captureAttendanceLocation()).status, "unavailable");
const hung = environment({ getCurrentPosition() {} }); const waiting = hung.api.captureAttendanceLocation();
[...hung.timers.values()][0](); assert.equal((await waiting).status, "timeout"); assert.equal(hung.timers.size, 0);
assert.equal(ok.api.needsLocationReview({ status: "within_boundary" }), false);
assert.equal(ok.api.needsLocationReview({ status: "outside_boundary" }), true);
assert.equal(ok.api.needsLocationReview(null), false);
assert.doesNotMatch(source, /watchPosition/);
const configSource = fs.readFileSync("next.config.ts", "utf8");
const configExports = {};
vm.runInNewContext(ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: configExports });
const headers = await configExports.default.headers();
const policy = item => item.headers.find(h => h.key === "Permissions-Policy").value;
assert.match(policy(headers.find(x => x.source === "/khpos/:path*")), /geolocation=\(\)/);
for (const path of ["/khpos/:organisationId/teaching-presence", "/khpos/hq/schools"])
  assert.match(policy(headers.find(x => x.source === path)), /geolocation=\(self\)/);
console.log("Attendance location browser capture passed: user-triggered single reading, fresh high-accuracy request, all permission/error paths, timeout cleanup and exception classification.");

const longCapture = environment({ getCurrentPosition(success, _failure, options) { assert.equal(options.timeout, 30000); success({coords:{latitude:6.55,longitude:3.25,accuracy:500},timestamp:Date.now()}); } });
assert.equal((await longCapture.api.captureAttendanceLocation({timeoutMs:30000})).accuracy,500);
for (const status of ["denied","timeout","unavailable","unsupported"])
 assert.match(ok.api.locationCaptureHelp(status),/coordinates manually/);
assert.match(ok.api.locationCaptureHelp("denied"),/permission was blocked/);
assert.match(ok.api.locationCaptureHelp("timeout"),/too long/);

// Exercise the actual pin screen's capture/review handlers, without network or GPS.
const campus={id:"campus",name:"Campus",canManage:true,location:null};
let state=[[campus],"campus","","","200","Verified on-site pin","","",false,null,false], cursor=0;
let reading={status:"captured",latitude:6.55,longitude:3.25,accuracy:500};
const panelExports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/components/khpos/CampusLocationPanel.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
}).outputText,{exports:panelExports,Number,Math,String,encodeURIComponent,require(name){
 if(name==="react/jsx-runtime")return jsxRuntime;
 if(name==="react")return {useMemo:f=>f(),useCallback:f=>f,useEffect:()=>{},useState:initial=>{
  const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==="function"?value(state[i]):value;}];
 }};
 if(name==="@/lib/supabase/client")return {createBrowserSupabaseClient:()=>({})};
 if(name==="@/lib/khpos/attendance-location")return {captureAttendanceLocation:async()=>reading,locationCaptureHelp:ok.api.locationCaptureHelp};
 throw new Error(name);
}});
function render(){cursor=0;return panelExports.CampusLocationPanel({school:"school"});}
function nodes(node){if(!node||typeof node!=="object")return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
function button(tree,text){return nodes(tree).find(n=>n.type==="button"&&n.props.children===text);}
let tree=render();await button(tree,"Use my current position for the pin").props.onClick();tree=render();
assert.equal(state[2],"6.55");assert.equal(state[3],"3.25");
assert.equal(button(tree,"Save campus location").props.disabled,true,"Approximate pin requires explicit review");
assert(nodes(tree).some(n=>n.type==="a"&&n.props.href.includes("google.com/maps/search")),"Pin can be checked on a map");
nodes(tree).find(n=>n.type==="input"&&n.props.type==="checkbox").props.onChange({target:{checked:true}});
assert.equal(button(render(),"Save campus location").props.disabled,false);
reading={status:"denied"};await button(render(),"Use my current position for the pin").props.onClick();
assert.match(state[6],/permission was blocked/);assert.equal(state[2],"6.55","Failed request does not overwrite coordinates");
reading={status:"captured",latitude:6.56,longitude:3.26,accuracy:10};
await button(render(),"Use my current position for the pin").props.onClick();
assert.equal(state[9],null);assert.equal(state[2],"6.56");
assert.equal(button(render(),"Save campus location").props.disabled,false);
console.log("Campus pin recovery passed: 30-second setup capture, distinct permission/timeout help, approximate-pin map review and confirmation, failed-capture preservation and accurate retry.");
