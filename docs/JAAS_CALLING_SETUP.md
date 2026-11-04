# Embedded calls: activation checklist

JaaS replaces all Google Meet controls on the meeting screen. Legacy Google endpoints and stored links remain available only in code/data; no automatic fallback or provider chooser appears to staff. Existing rooms use their stable meeting UUID as the JaaS room, independent of legacy call parts. No database migration is needed.

## Account configuration

Create a JaaS tenant at https://jaas.8x8.vc/ and register an RSA public key. Add these **server-only** Vercel production environment variables:

- `JAAS_APP_ID`: tenant ID beginning `vpaas-magic-cookie-`
- `JAAS_API_KEY_ID`: full tenant/key identifier shown in the JaaS console
- `JAAS_PRIVATE_KEY`: corresponding RSA private key (2048 bits or stronger), stored as a Secret; actual newlines or escaped `\n` supported

Never put the private key in chat, GitHub, browser code or a NEXT_PUBLIC variable. Deploy after configuration. Do not replace the working production UI until account configuration is complete and a private pilot can run.

## Privacy and permissions

The join endpoint requires a verified KHP-OS bearer token and checks the existing meeting RPC for invitation and active membership. Tokens expire after ten minutes and permit only the exact meeting room. Only its eligible host receives moderation rights. Recording, transcription, livestreaming, file uploads and phone-call features are denied. Tokens live in React memory only and are not included in copied meeting links. The JaaS SDK loads only after Join call is tapped. Camera and microphone permission is scoped to self and https://8x8.vc throughout KHP-OS documents because App Router navigation reuses the first document's Permissions-Policy. The API policy stays restrictive.

JaaS receives participant ID/name and call media. A token already issued remains usable until expiry; closing a room prevents new tokens and disposes calls in connected app clients after the room update, but is not provider-side revocation of every existing connection.

## Pilot before broad rollout

1. Use two invited users on different Android phones; verify embedded audio/video permissions, mute, camera off, leave/rejoin and meeting switching.
2. Verify an uninvited account cannot obtain a token, and guest users cannot moderate.
3. Test an uninterrupted group call beyond one hour and reconnection after the ten-minute token issuance window. Token expiry controls admission; actual ongoing call behaviour must be confirmed with JaaS.
4. Test closing/cancelling the room, and retain decisions plus Today follow-ups.
5. Inspect JaaS Activity for monthly endpoint usage and verify account-specific overage behaviour before adding schools. The free allowance is 25 monthly endpoints, not 25 meetings; this release does not enforce a provider billing cap.

Automated tests verify JWT signatures, exact room scope, expiry and host privilege plus existing database access checks. They cannot confirm real media, Android permissions, free-tier billing behaviour or provider availability without a configured tenant.
