# KHP-OS Lite — Android distribution shell

KHP-OS Lite is a Trusted Web Activity (TWA) wrapper around the live KSHC/KHP-OS origin. It is a distribution shell, not a reduced KHP-OS product and not a second codebase.

## Production identity

- Display name: `KHP-OS Lite`
- Launcher name: `KHP-OS`
- Package ID: `ng.name.khpos.lite`
- Current version: `1.0.0`
- Version code: `1`
- Production origin: `https://www.kshc.name.ng`
- Start route: `/khpos`
- Minimum Android API: 21
- Bubblewrap toolchain: `1.25.0`
- Stable public APK URL: `https://github.com/synsynlele/kaec-school-health-check/releases/latest/download/KHP-OS-Lite.apk`

Routine KHP-OS product, Supabase and interface releases remain web-first. The TWA loads the live KSHC origin, so normal KHP-OS releases do not require a new Android binary.

## App icon contract

The installed identity must always use the exact existing KSHC favicon artwork from `src/app/icon.svg`: the blue rounded square, white health pulse and green dot. No alternate KHP-OS app mark is permitted unless the product identity is deliberately changed later.

- Desktop PWA: 192px and 512px raster exports of that exact artwork.
- Android Lite: an exact SVG copy of `src/app/icon.svg`, verified byte-for-byte by the KHP-OS Lite regression contract.

The Android build uses immutable raw-GitHub copies of the exact SVG and bootstrap manifest. This allows the signed binary to be produced safely before new PWA assets reach the production KSHC origin.

## Permanent signing identity

The production certificate SHA-256 fingerprint is pinned in `twa-manifest.production.json` and `public/.well-known/assetlinks.json`.

The private keystore and password must never be committed. The production keystore is PKCS#12, so Bubblewrap uses the same password for store and private-key access. The release workflow expects these protected GitHub Actions secrets:

- `KHPOS_ANDROID_KEYSTORE_B64`
- `KHPOS_ANDROID_KEYSTORE_PASSWORD`

Future Android wrapper releases must use the exact same production key. Increment `appVersionCode` and `appVersion`, then run the protected release workflow.

## Pre-merge release gate

The Android release workflow runs when distribution files change on the `stage-khpos-lite-distribution` branch. Until the protected signing secrets exist, that run is expected to stop at the signing-secret gate. Once the secrets are stored, a fresh distribution commit or manual workflow dispatch must build from the current verified head, verify the permanent certificate, build the signed APK/AAB and publish `KHP-OS-Lite.apk` before the web landing-page download is allowed into production.

After this release is merged, normal wrapper releases are manual via `workflow_dispatch` and are needed only when the Android wrapper itself changes.

## Release model

`.github/workflows/android-lite-release.yml` builds a signed APK and AAB with Bubblewrap and publishes a GitHub Release. The APK asset is always named `KHP-OS-Lite.apk`, allowing the KSHC landing page to use GitHub's stable `releases/latest/download` URL without another web deployment merely to change an APK link.

Changes to Android distribution files, including the exact SVG app icon, intentionally trigger the protected release workflow on the pre-merge distribution branch. This lets the first signed binary be produced from the exact current branch head without enabling a Vercel deployment.

Do not merge a landing-page Android download button into production before the first signed `KHP-OS-Lite.apk` release exists.
