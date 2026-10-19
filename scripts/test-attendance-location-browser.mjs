import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
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
