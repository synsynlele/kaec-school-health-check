import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/khpos/ops/retry-transient-auth.ts", "utf8");
const exports = {};
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(js, { exports, setTimeout, Error });
const retry = exports.retryFutureIssuedJwtRead;
const future = { data: null, error: { message: "JWT issued at future" } };
const success = { data: { ok: true }, error: null };
let attempts = 0;
const pauses = [];
const recovered = await retry(
  () => Promise.resolve(++attempts === 1 ? future : success),
  async (ms) => { pauses.push(ms); },
);
assert.equal(recovered, success);
assert.equal(attempts, 2);
assert.deepEqual(pauses, [1200]);
attempts = 0;
assert.equal(await retry(() => Promise.resolve((attempts++, success))), success);
assert.equal(attempts, 1);
attempts = 0;
const denied = { data: null, error: { message: "permission denied" } };
assert.equal(await retry(() => Promise.resolve((attempts++, denied))), denied);
assert.equal(attempts, 1);
attempts = 0;
assert.equal(await retry(() => Promise.resolve((attempts++, future)), async () => {}), future);
assert.equal(attempts, 2);
for (const file of ["work.ts", "issues.ts", "decisions.ts"]) {
  const text = fs.readFileSync("src/lib/khpos/ops/" + file, "utf8");
  assert.match(text, /retryFutureIssuedJwtRead/);
}
console.log("Transient JWT retry tests passed.");


// The server-side KSHC account uses direct PostgREST fetches, not supabase-js.
// The retry must be bounded, strictly recognise PGRST303, and never alter JWTs.
const pgrstError = JSON.stringify({code:"PGRST303",details:null,hint:null,message:"JWT issued at future"});
const reply = (status, text) => ({
  status,
  clone() { return { text: async () => text }; },
});
const blocked = reply(401,pgrstError);
const ok = reply(200,"[]");
assert.equal(exports.isFutureIssuedJwtFailure(401,pgrstError),true);
assert.equal(exports.isFutureIssuedJwtFailure(403,pgrstError),false);
assert.equal(exports.isFutureIssuedJwtFailure(401,JSON.stringify({code:"PGRST303",message:"JWT expired"})),false);
assert.equal(exports.isFutureIssuedJwtFailure(401,"not-json"),false);
assert.equal(exports.isFutureIssuedJwtMessage("Supabase 401: "+pgrstError),true);
assert.equal(exports.isFutureIssuedJwtMessage("Unexpected 401"),false);
attempts = 0;
pauses.length = 0;
assert.equal(await exports.retryFutureIssuedJwtHttpRead(
  async () => ++attempts===1 ? blocked : ok,
  async (ms) => { pauses.push(ms); }
),ok);
assert.equal(attempts,2);
assert.deepEqual(pauses,[1200]);

attempts = 0; pauses.length = 0;
assert.equal(await exports.retryFutureIssuedJwtHttpRead(
  async () => ++attempts<=2 ? blocked : ok,
  async (ms)=>{pauses.push(ms);}
),ok);
assert.equal(attempts,3);
assert.deepEqual(pauses,[1200,2600]);

attempts = 0;
const revoked=reply(401,JSON.stringify({code:"PGRST303",message:"JWT expired"}));
assert.equal(await exports.retryFutureIssuedJwtHttpRead(
  async()=>{attempts++;return revoked;},
  async()=>{throw Error("Non-transient errors must not be retried");}
),revoked);
assert.equal(attempts,1);

attempts = 0;
assert.equal(await exports.retryFutureIssuedJwtHttpRead(
  async()=>{attempts++;return blocked;},
  async()=>{}
),blocked);
assert.equal(attempts,3,"Transient failure retries must be bounded to three attempts");

attempts=0;pauses.length=0;
const account=await exports.retryFutureIssuedJwtTask(
  async()=>{if(++attempts===1)throw new Error("Supabase 401: "+pgrstError);return "account loaded";},
  async(ms)=>{pauses.push(ms);}
);
assert.equal(account,"account loaded");
assert.equal(attempts,2);
assert.deepEqual(pauses,[1500]);

attempts=0;
await assert.rejects(exports.retryFutureIssuedJwtTask(
  async()=>{attempts++;throw new Error("A user is not authorised");},
  async()=>{throw Error("Must not retry unrelated error");}
),/not authorised/);
assert.equal(attempts,1);

const storage = fs.readFileSync("src/lib/storage.ts","utf8");
const workspace = fs.readFileSync("src/lib/khpos/workspace.ts","utf8");
const accountRoute = fs.readFileSync("src/app/api/account/route.ts","utf8");
const accountView = fs.readFileSync("src/components/account/AccountAccess.tsx","utf8");
assert.match(storage,/method === "GET" \|\| method === "HEAD"/);
assert.match(storage,/retryFutureIssuedJwtHttpRead\(makeRequest\)/);
assert.match(storage,/: await makeRequest\(\)/,"Writes must have no retry path");
assert.match(workspace,/retryFutureIssuedJwtHttpRead/);
assert.match(accountRoute,/retryFutureIssuedJwtTask/);
assert.match(accountRoute,/status: 503/);
assert.match(accountView,/response\.status === 503/);
console.log("PGRST303 account recovery: bounded safe reads, preserved JWT security, write protection, and recoverable UI passed.");
