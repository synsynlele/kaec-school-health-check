# KHP-OS Stage 1C — Google-First Activation Bridge

Stage 1C is the first visible bridge from the public KAEC School Health Check into the secure KHP-OS institutional workspace.

## User journey

KSHC report → Activate KHP-OS → Google sign-in/sign-up → verified assessment claim → institutional Command Centre.

Google is the primary authentication path. The same Google OAuth action creates a Supabase Auth user on first use and signs returning users in on later visits. Passwordless email remains a secondary fallback for users whose KSHC email is not available through Google.

## Security model

- KSHC remains login-free.
- Only a completed KSHC assessment can be activated.
- The access token is verified against Supabase Auth on the application server.
- The verified and confirmed auth email must exactly match the email used for the KSHC assessment.
- The claim RPC is service-role-only; `anon` and `authenticated` cannot execute it directly.
- The claim function independently verifies `auth.users` again before linking the assessment.
- Workspace reads are server-mediated and require an active organisation membership before any institutional data is returned.

## Command Centre scope

The first Command Centre intentionally exposes only capabilities earned in Stage 1:

- permanent institution identity;
- preserved KSHC baseline;
- health score and primary diagnostic attention area;
- structured diagnostic priority areas;
- 11-area baseline detail;
- visible KHP-OS transformation lifecycle;
- clear hand-off to the next Priority/Intervention layer.

It does not pretend that intervention execution, evidence, review or reassessment modules are complete.

## Auth compatibility

- Google OAuth uses PKCE.
- Passwordless email fallback uses an isolated implicit Magic Link initiation so it does not require a customised PKCE email template.
- The callback supports both a PKCE authorization code and a Magic Link token fragment, imports the resulting session, cleans the URL and returns the user to activation.

## Vercel quota policy

No Vercel deployment should be created for intermediate Stage 1C commits. GitHub CI is the normal validation gate. A single preview deployment should be used only after CI is green and Supabase security checks pass, because browser-level OAuth verification is the point at which a deployment becomes materially necessary.
