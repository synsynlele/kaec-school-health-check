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
 assert.deepEqual(JSON.parse(init.body),{},'Creation must match the documented request that succeeded in Google APIs Explorer');
 return Response.json({meetingUri:links[index++],config:{accessType:"TRUSTED"}});
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
console.log('Call plans: hour splitting, warning boundaries, estimated clock, Google request scope, host-default call settings, partial failures, timeout retention and invalid-link rejection passed.');
const failure = async (status, details) => {
 try { await createGoogleMeetParts('test',1,async()=>Response.json({error:{message:'SECRET_DO_NOT_RETURN',details}},{status}));assert.fail('Expected provider failure'); }
 catch(error){assert(!error.message.includes('SECRET_DO_NOT_RETURN'));return error;}
};
const info=(reason,metadata={})=>({'@type':'type.googleapis.com/google.rpc.ErrorInfo',domain:'googleapis.com',reason,metadata});
const disabled=await failure(403,[info('SERVICE_DISABLED',{service:'meet.googleapis.com',consumer:'projects/123456789012',activationUrl:'https://evil.invalid'})]);
assert.equal(disabled.code,'meet_api_disabled');
assert.equal(disabled.setupUrl,'https://console.cloud.google.com/apis/library/meet.googleapis.com?project=123456789012');
const badConsumer=await failure(403,[info('SERVICE_DISABLED',{service:'meet.googleapis.com',consumer:'projects/123456?credential=secret'})]);
assert.equal(badConsumer.setupUrl,'https://console.cloud.google.com/apis/library/meet.googleapis.com');
assert.equal((await failure(403,[info('ACCESS_TOKEN_SCOPE_INSUFFICIENT')])).code,'google_permission_missing');
assert.equal((await failure(401,[])).code,'google_connection_expired');
assert.equal((await failure(403,[])).code,'google_access_denied');
assert.equal((await failure(429,[])).code,'google_quota');
const malformed=await failure(403,[null,{reason:'SERVICE_DISABLED',metadata:{activationUrl:'https://evil.invalid'}}]);
assert.equal(malformed.code,'google_access_denied');
console.log('Google setup diagnostics: disabled API, correct project link, missing scope, expired connection, unknown denial, quota and raw-error redaction passed.');
