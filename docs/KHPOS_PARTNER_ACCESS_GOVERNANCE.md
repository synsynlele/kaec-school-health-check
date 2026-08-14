# KHP-OS Partner Access Governance

## Product rule

KSHC and KHP-OS deliberately have different access models.

- **KSHC is open:** a school can create a free account, run the School Health Check and retain its diagnostic records.
- **KHP-OS is partnership access:** an account, KSHC report or organisation claim does not by itself grant the institutional transformation workspace.

KHP-OS requires two independent conditions:

1. the institution has `partner_status = active`; and
2. the user has an `active` membership in that exact institution.

The database prevents an active membership from existing while the institution partnership is not active. Operational KHP-OS functions continue to require an active membership, so partnership suspension or termination revokes the transformation system across the existing workflow rather than merely hiding navigation.

## Partnership lifecycle

- `pending` — verified KSHC owner has requested partnership; KHP-OS is locked.
- `active` — KAEC-NG has approved the institution; authorised memberships may enter KHP-OS.
- `suspended` — KHP-OS memberships are suspended immediately; KSHC records remain available.
- `ended` — partnership and KHP-OS membership access are ended; historical KSHC records remain preserved.

## Product entitlements

The initial entitlement vocabulary is:

- `khpos_core`
- `ksi_integration`
- `pipupath_intelligence`
- `benchmarking`

Entitlements are subordinate to partnership status. An entitlement never bypasses `partner_status = active`.

## School flow

1. Create/sign in to a free KSHC account.
2. Complete KSHC.
3. From the completed report, request KHP-OS partnership using the verified assessment email.
4. The institution and executive membership are recorded as `pending` unless the institution is already an active partner.
5. The school can view its partnership status from the account area.
6. Only after KAEC-NG approval does the account expose `Open KHP-OS`.

## KAEC-NG governance

The private Partnership Registry is available at `/khpos/admin/partnerships` to authorised KHP-OS platform administrators.

- Support Reviewers may inspect the registry.
- Super Admins and Portfolio Admins may make partnership decisions.
- Approval, suspension, reactivation and ending a partnership require an MFA-backed AAL2 session in the application layer and a governance reason of at least 12 characters.
- Every partnership decision is recorded in both the platform and institution audit trails.

## Database verification

The production migration `20260814225329_partner_access_entitlement_gate` was verified inside a rollback-only transaction:

- a pending institution could not be given an active membership;
- approval activated the partnership and pending membership;
- suspension revoked the active membership;
- reactivation restored it;
- ending the partnership ended the membership;
- the platform registry returned the institution only through privileged administration;
- all synthetic verification records rolled back to zero.

The follow-up migration `20260814230238_partner_access_approved_by_index` adds the covering index recommended by the database performance advisor for `partner_approved_by`.

## Security boundary

The partner registry and partner-management RPCs are server-only (`service_role`). Ordinary `anon` and `authenticated` database roles cannot execute them directly. The browser proves identity with Supabase Auth; application APIs verify the access token; the server then invokes the bounded governance RPCs.

KHP-OS does not infer partnership from email domain, school name, location, KSHC completion or account creation. KAEC-NG approval is explicit.
