import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { JAAS_APP_ID: 'vpaas-magic-cookie-test', JAAS_API_KEY_ID: 'vpaas-magic-cookie-test/key1', JAAS_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/khpos/ops/jaas.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => crypto, Buffer, process: { env } });
const session = exports.createJaasSession;
const workspace = { userId: 'host', canCreate: true, room: { meeting: { id: 'room1', created_by: 'host', status: 'scheduled' }, participants: [{ user_id: 'host', name: 'School host' }] } };
const result = session(workspace, 1000);
const [header, body, signature] = result.jwt.split('.');
const payload = JSON.parse(Buffer.from(body, 'base64url'));
assert(verify('RSA-SHA256', Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url')));
assert.equal(payload.room, 'khpos-room1');
assert.equal(payload.context.room.regex, false);
assert.equal(payload.context.user.moderator, 'true');
assert.equal(payload.exp, 1600);
assert.equal(payload.nbf, 970);
assert.equal(payload.context.features.recording, false);
assert.equal(result.roomName, 'vpaas-magic-cookie-test/khpos-room1');
const guest = session({ ...workspace, userId: 'guest', canCreate: true }, 1000);
assert.equal(JSON.parse(Buffer.from(guest.jwt.split('.')[1], 'base64url')).context.user.moderator, 'false');
assert.throws(() => session({ ...workspace, room: null }), /not found/);
assert.throws(() => session({ ...workspace, room: { ...workspace.room, meeting: { ...workspace.room.meeting, status: 'closed' } } }), /closed/);
delete env.JAAS_PRIVATE_KEY;
assert.throws(() => session(workspace), /awaiting account setup/);
console.log('JaaS: RSA signature, exact room restriction, host-only moderation, token lifetime, disabled paid features, closed rooms and missing configuration passed.');
// Exercise HTTP authorization before any JaaS token is returned.
const routes = {};
let calls = 0;
class AuthError extends Error { constructor(message, status = 401) { super(message); this.status = status; } }
let allowed = true;
const meetingId = '12345678-1234-1234-1234-123456789abc';
const routeWorkspace = { ...workspace, room: { ...workspace.room, meeting: { ...workspace.room.meeting, id: meetingId } } };
const routeSource = ts.transpileModule(fs.readFileSync('src/app/api/khpos/ops/meetings/[id]/call/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(routeSource, { exports: routes, URL, require: name => {
 if (name === 'next/server') return { NextResponse: { json: (data, options) => ({ data, ...options }) } };
 if (name.endsWith('/http')) return { UUID_RE: /^[0-9a-f-]{36}$/ };
 if (name.endsWith('/auth')) return { KhposAuthError: AuthError, bearerTokenFromRequest: request => request.headers.get('Authorization'), verifyKhposAccessToken: async () => ({ id: 'host' }) };
 if (name.endsWith('/meetings')) return { meetingOperation: async () => { calls++; if (!allowed) throw Object.assign(new Error('Access denied'), { status: 403 }); return routeWorkspace; } };
 if (name.endsWith('/jaas')) return { createJaasSession: () => ({ jwt: 'test-only', roomName: 'test-only' }) };
 throw new Error(name);
} });
const context = { params: Promise.resolve({ id: meetingId }) };
const url = `https://example.test/api/khpos/ops/meetings/${meetingId}/call?meeting=${meetingId}`;
assert.equal((await routes.POST(new Request(url, { method: 'POST' }), context)).status, 401);
assert.equal(calls, 0);
allowed = false;
assert.equal((await routes.POST(new Request(url, { method: 'POST', headers: { Authorization: 'test' } }), context)).status, 403);
allowed = true;
const success = await routes.POST(new Request(url, { method: 'POST', headers: { Authorization: 'test' } }), context);
assert.equal(success.data.jwt, 'test-only');
assert.equal(success.headers['Cache-Control'], 'private, no-store');
console.log('JaaS HTTP: signed-out and uninvited access rejected before token issuance; successful response is not cacheable.');
// Live meetings remain discoverable after their planned end until explicitly closed.
const meetingExports = {};
const now = Date.parse('2026-11-05T12:00:00Z');
const meetings = [
 { id: 'live', title: 'Live review', status: 'live', starts_at: '2026-11-05T08:00:00Z', ends_at: '2026-11-05T09:00:00Z' },
 { id: 'closed', title: 'Finished', status: 'closed', starts_at: '2026-11-05T11:00:00Z', ends_at: '2026-11-05T14:00:00Z' },
 { id: 'cancelled', title: 'Cancelled', status: 'cancelled', starts_at: '2026-11-05T11:00:00Z', ends_at: '2026-11-05T14:00:00Z' },
 { id: 'scheduled', title: 'Next meeting', status: 'scheduled', starts_at: '2026-11-05T13:00:00Z', ends_at: '2026-11-05T14:00:00Z' }
];
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/khpos/ops/meetings.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
 exports: meetingExports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' } },
 require: () => ({ createClient: () => ({ rpc: async () => ({ data: { meetings }, error: null }) }) })
});
const alerts = await meetingExports.getMeetingAlerts('school', 'host', now);
assert.deepEqual(Array.from(alerts, a => a.id), ['meeting:live', 'meeting:scheduled']);
assert.equal(alerts[0].live, true);
assert.equal(alerts[1].live, false);
console.log('Meeting discovery: live calls survive planned-end time; closed/cancelled calls disappear; upcoming invitations remain.');
