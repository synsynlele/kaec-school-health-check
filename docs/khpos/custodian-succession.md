# KHP-OS — Change School Custodian

**Objective:** A school can transfer its School Custodian authority to the rightful proprietor/proprietress or a legitimate successor without deleting School Health Check (KSHC) history, without cutting off governance before the replacement agrees, and without creating new high-risk owner permissions through ordinary staff-position controls.

## Standard handover
1. The active **School Custodian** opens **Staff → Change School Custodian / succession**.
2. Enter the incoming Custodian's **own verified email** and explain the authorised handover. If the outgoing Custodian will become **School Guardian**, keep that option and choose the campus if the school has more than one.
3. The nominated proprietor/proprietress signs up or signs in with the **same verified email**, opens the KHP-OS entrance, and **accepts** under School Custodian invitations.
4. A different authorised **KAEC platform administrator** verifies the proposed person's authority independently, completes MFA, and approves or rejects the request in **Admin Console → School Custodian transfers and recoveries**.
5. **Only after final approval** does the single transaction end the old Custodian role, activate the incoming Custodian, transfer executive school membership where appropriate, and assign the old person a campus School Guardian role if requested.

**Important:** An account's telephone number or historical KSHC assessment submitter is not school ownership. Historical school health checks, report author names, staff records and audit evidence are retained and not rewritten.

## Special cases
- If the former Custodian is no longer available, an authorised KAEC administrator may initiate recovery, but **another independent administrator** must approve. This requires a verified successor's acceptance. The administrator records how the proprietor's authority was established; no identity documents are pasted into the app.
- Existing ordinary staff or additional-position controls **cannot** appoint or remove a School Custodian. They continue to govern normal staff roles.
- If the outgoing Custodian has no linked active staff profile, their newly assigned Guardian *role* can be active, but the incoming Custodian should add/link their staff profile and complete normal onboarding before they perform staff-specific daily workflows.
- When the outgoing Custodian must retire instead of becoming Guardian, disable the Guardian option. An outgoing active staff profile must have its operating appointment separately handled by People; the transfer does not silently terminate employment.
- To avoid founder bottlenecks, an appointed portfolio administrator with MFA can serve as independent reviewer (not the initiating administrator).

## Security boundaries
- No role transfer at request or acceptance stage.
- The successor must use a verified email account. Approval must be by a different individual from the requester, outgoing and incoming Custodians.
- An MFA-confirmed reviewer is required.
- The database refuses simultaneous active Custodian seats, cross-school and wrong-campus assignments, repeated pending requests for one school, and approval after a competing Custodian appointment.
- The former account's school executive status is reduced when the handover completes. Staff identities and KSHC history remain.
- The privileged transition API is server-only; the underlying PostgreSQL function and tables deny anonymous/authenticated direct privileges. Events are logged.
- Full signed-in handover QA must verify the three distinct actors and confirm school isolation and that no active KSHC report is lost.

**Rollout caution:** This feature creates *new tooling*, not a transfer of any school's current Custodian until a deliberate, properly authorised request is completed.
