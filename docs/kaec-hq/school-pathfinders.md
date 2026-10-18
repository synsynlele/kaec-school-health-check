# KAEC HQ — School Pathfinders operational acceptance

## Purpose
KAEC HQ is a working corporate supervision centre, not a document archive.
A **School Pathfinder** is a KAEC-NG representative assigned to one or more partner schools
to guide implementation, hold agreed parties accountable, verify progress by remote follow-up,
and recommend a physical visit when needed. A School Pathfinder is not the school's Guardian,
Custodian, a platform administrator, or an automatic signatory to an agreement.

## Real source of truth
The existing KHP-OS Partnership Registry controls the school's platform partner status and entitlements.
Only an active, core-entitled school (not KNS flagship) can be linked.
An active KHP-OS account is **not** evidence of a signed supervision/management contract.
Corporate School Desk setup cannot grant or change institutional KHP-OS access.
An authorised Vision Custodian must confirm an actual signed agreement reference and its precise
scope before activating oversight. Do not invent contract terms or report impact that has not been verified.

## Minimal working sequence
1. The Vision Custodian appoints a verified corporate user with **School Pathfinder** role in HQ People & Roles.
2. The Alliance Catalyst or Vision Custodian opens HQ → School Pathfinders and links a registered
   partner. The new engagement remains **Setup**; there is no automatic supervision or access.
3. Verify the signed contract outside this system. Enter its document reference, support scope, school
   liaison and nominated Pathfinder; confirm with MFA. Activate only under the real agreement.
4. Create measurable commitments mapped to specific agreement clauses or signed implementation plans:
   expected change, evidence required, priority, due date, next virtual check and whether onsite is needed.
5. The appointed Pathfinder logs each real contact (phone, video, WhatsApp, email) or school visit:
   outcome, evidence reference, next check and visit date. Follow-up history is append-only.
6. The Pathfinder marks the commitment progressing, blocked, or evidence submitted. An independent
   Alliance Catalyst or Vision Custodian reviews verified evidence; not the reporting Pathfinder.
   False assurances, unverified claims, and direct student records do not belong in HQ.
7. The corporate School Desk prioritises overdue, blocked, awaiting-verification and assigned work.
   Actual school-level safeguards, student information and restricted teaching records stay in KHP-OS.

## Approval workflow
Corporate Governance records in_review now show whether any eligible reviewer is appointed.
The author can withdraw an unreviewed submission for revision. This does not itself grant approval.
Only a different authorised corporate person can approve controlled reviews. Formal shareholder,
contractual, financial, and constitutional decisions still require their real-world legal authority.
A solo founder can log ordinary Work completion, but must not represent it as independent verification.

## Accepted scope and limitations
- Role-scoped schools and server-protected independent HQ tables, RLS, no public grants.
- No automatic school-data mirroring: follow-up and commitment summaries are human-verified; formal
  KHP-OS data access and purpose limitation need their own documented agreement and authorisation.
- No SMS/WhatsApp messaging or visit booking API; these are manually conducted, auditable actions.
- No cron-triggered escalation or push delivery yet; the dashboard derives due/blocked states on request.
- The first release does not import signed contracts or infer obligations automatically.
- Read-only corporate System Steward can audit supervision; School Pathfinders cannot approve contracts.
- Backend report limits are 200 engagements, 300 commitments and 300 follow-ups per snapshot, with a
  prominent capped-data warning. Wider deployments need paginated filters and server-side KPIs.

## Production gates
1. Run all GitHub CI checks including PGlite role/RLS/contract/evidence/audit and service scope tests.
2. Apply reviewed schema migration before merging production code.
3. Verify new tables deny anon/authenticated direct access and only service_role has privileges.
4. Preserve all existing KHP-OS school accounts and school documents.
5. Deploy production once by merging a tested PR. Verify Vercel READY, live authenticated navigation,
   safe empty state, source register candidate schools, and unauthenticated 401 for both APIs.
6. Insert partner engagement setup entries only when confirmed from the existing KHP-OS register;
   do NOT mark signed agreement, assign a Pathfinder or invent due dates.
