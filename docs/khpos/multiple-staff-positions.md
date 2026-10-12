# Multiple staff positions

This batch lets a school appoint an existing staff member to additional positions using the same account. It does not assign positions automatically or alter existing primary appointments.

## Everyday use

- **People → Staff positions:** choose an active, account-linked staff member, then propose a position for a campus and, where needed, a section or programme. School Custodians and appropriately scoped School Guardians can manage additional positions. Only a School Custodian can appoint a Guardian. Appointing a Custodian continues through the existing governed route.
- **My Onboarding → My positions:** the appointed person reads the role mission, responsibilities, decision rights and escalation rules; acknowledges the current policies; and accepts the responsibilities in their own words. Core practice is shared across positions in the same school. Use Refresh readiness after completing practice.
- **People → Confirm readiness and activate:** a different authorised leader records an independent readiness review. Pending proposals grant no additional authority. Activation creates a secondary role assignment and preserves the primary staff appointment.
- **Today → My work by position:** staff can see all their work or filter by position. Reviews of other staff remain separate and visible. Attention links restore all work so their exact record can be found.
- **My Onboarding → View responsibilities for:** staff can view duties, policies and process participation for any of their active positions in the current school. The primary appointment checklist and Core practice remain shared.
- **End additional position:** the leader records a reason after open work, issues and decisions have been completed or handed over. The primary appointment cannot be ended through this route. Records and event history are retained.

## Independent review

The review queue and verification action use the same database permission function. It finds the nearest independently staffed position in the owner's reporting chain within the work's campus and section. If a teacher is also their own Sectional Promoter, another suitably scoped Academic Inspector can review the teaching work. If another independent Promoter exists in that section, that level remains the normal route. Properly scoped School Guardians and School Custodians retain leadership review authority. Holding another title never permits reviewing one's own work.

School authority is school-specific. KAEC-NG Vision Custodian or platform access alone does not confer school appointment or work-review authority.

## Security and validation

The new table has RLS enabled and no direct anonymous or authenticated-client privileges. Server functions accept an actor identity supplied by the authenticated API, not a client-submitted actor. Campus, section, role, staff and membership boundaries are checked in the database. Overlapping appointments are rejected; staff-row locks serialise activation and proposals. Charter revisions invalidate previous role acceptance. Verification locks the work row before changing its state.

Automated coverage includes 32 isolated PostgreSQL behaviour and privilege checks, plus service tests for school-specific onboarding role choices. The PostgreSQL fixture contains current dependency column types/defaults and the existing membership function. It is not a full production clone; production triggers, all pre-existing constraints, and signed-in browser acceptance are outside that fixture's coverage. The new migration runs with its actual constraints and privileges in the fixture.

## Release order

1. Review and approve this batch for production.
2. Apply `20261012104812_multiple_staff_positions.sql` before deploying the application code. The new Today service requires the verification-routes RPC.
3. Deploy the reviewed code; verify authenticated People, My Onboarding and Today flows using two different authorised accounts. Check a teacher who also holds a Promoter appointment, a rejected cross-school request, and blocked self-review.
4. Confirm that pending appointments grant no new assignment and that existing primary assignments remain active.

Production migration applied on 12 October 2026 as version 20261012104812. No staff positions or appointment changes were made by the migration; application deployment and signed-in acceptance remain separate gates. This batch does not certify full school readiness. Remaining school-readiness and signed-in acceptance checks from the earlier audit still apply.
