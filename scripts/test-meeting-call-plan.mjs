import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function moduleFrom(path,require=()=>({})){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,AbortSignal,fetch,Response});return exports;}
const plan=moduleFrom('src/lib/khpos/ops/call-plan.ts');
const start='2026-11-05T10:00:00Z',t=Date.parse(start);
assert.equal(plan.meetingEnd(start,3),'2026-11-05T13:00:00.000Z');
assert.equal(plan.callProgress(start,1,3,t+3299000).warn,false);
assert.equal(plan.callProgress(start,1,3,t+3300000).warn,true);
assert.equal(plan.callProgress(start,1,3,t+3600000).remainingSeconds,0);
assert.equal(plan.callProgress(start,1,3,t-1000).elapsedSeconds,0);
assert.equal(plan.callProgress(null,0,3,t).warn,false);
assert.equal(plan.callProgress('bad',0,3,t).warn,false);
assert.equal(plan.callProgress(start,3,3,t+3300000).hasNext,false);
const {createGoogleMeetParts}=moduleFrom('src/lib/khpos/ops/google-meet.ts',()=>plan);
const links=['https://meet.google.com/abc-defg-hij','https://meet.google.com/klm-nopq-rst','https://meet.google.com/uvw-xyza-bcd'];
let index=0;
const generated=await createGoogleMeetParts('test-token',3,async(url,init)=>{
 assert.equal(url,'https://meet.googleapis.com/v2/spaces');assert.equal(init.method,'POST');assert.equal(init.headers.Authorization,'Bearer test-token');
 assert.equal(JSON.parse(init.body).config.accessType,'RESTRICTED');
 return Response.json({meetingUri:links[index++]});
});
assert.deepEqual(Array.from(generated),links);
await assert.rejects(createGoogleMeetParts('test',7),/one and six/);
await assert.rejects(createGoogleMeetParts('test',2,async()=>new Response('',{status:403})),/permission/);
index=0;
try{await createGoogleMeetParts('test',3,async()=>index++===0?Response.json({meetingUri:links[0]}):new Response('',{status:429}));assert.fail();}
catch(e){assert.equal(e.status,429);assert.deepEqual(Array.from(e.links),[links[0]]);}
index=0;
try{await createGoogleMeetParts('test',3,async()=>{if(index++===0)return Response.json({meetingUri:links[0]});throw new Error('Network failure');});assert.fail();}
catch(e){assert.equal(e.status,504);assert.deepEqual(Array.from(e.links),[links[0]]);}
await assert.rejects(createGoogleMeetParts('test',1,async()=>Response.json({meetingUri:'https://evil.invalid'})),/invalid/);
await assert.rejects(createGoogleMeetParts('test',2,async()=>Response.json({meetingUri:links[0]})),/duplicate/);
console.log('Call plans: hour splitting, warning boundaries, estimated clock, Google request scope, restricted rooms, partial failures, timeout retention and invalid-link rejection passed.');
