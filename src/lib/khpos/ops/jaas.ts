import { createPrivateKey, sign } from "node:crypto";
import type { MeetingWorkspace } from "./meetings";

// Called only after the existing meeting RPC has checked invitation + membership.
export function createJaasSession(workspace: MeetingWorkspace, now = Math.floor(Date.now() / 1000)) {
 const room = workspace.room;
 if (!room) throw Object.assign(new Error("Meeting not found."), { status: 404 });
 if (["closed", "cancelled"].includes(room.meeting.status)) throw Object.assign(new Error("This meeting is closed."), { status: 409 });
 const appId = process.env.JAAS_APP_ID;
 const keyId = process.env.JAAS_API_KEY_ID;
 const pem = process.env.JAAS_PRIVATE_KEY?.replace(/\\n/g, "\n");
 if (!appId || !keyId || !pem) throw Object.assign(new Error("In-app calling is awaiting account setup. You can still use the discussion and save follow-ups."), { status: 503 });
 if (!/^vpaas-magic-cookie-[a-zA-Z0-9]+$/.test(appId) || !keyId.startsWith(`${appId}/`)) throw new Error("Calling configuration is invalid.");
 const name = room.participants.find(p => p.user_id === workspace.userId)?.name || "KHP-OS participant";
 const meetingRoom = `khpos-${room.meeting.id}`;
 const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
 const header = encode({ alg: "RS256", typ: "JWT", kid: keyId });
 const payload = encode({ aud: "jitsi", iss: "chat", sub: appId, room: meetingRoom, nbf: now - 30, exp: now + 600,
  context: { room: { regex: false }, user: { id: workspace.userId, name, moderator: room.meeting.created_by === workspace.userId && workspace.canCreate ? "true" : "false" },
   features: { recording: false, transcription: false, livestreaming: false, "inbound-call": false, "outbound-call": false, "sip-inbound-call": false, "sip-outbound-call": false, "file-upload": false } } });
 const key = createPrivateKey(pem);
 if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error("Calling configuration is invalid.");
 const token = `${header}.${payload}`;
 return { roomName: `${appId}/${meetingRoom}`, jwt: `${token}.${sign("RSA-SHA256", Buffer.from(token), key).toString("base64url")}` };
}
