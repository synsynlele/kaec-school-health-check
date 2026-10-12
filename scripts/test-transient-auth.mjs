import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/khpos/ops/retry-transient-auth.ts", "utf8");
const exports = {};
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(js, { exports, setTimeout });
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
