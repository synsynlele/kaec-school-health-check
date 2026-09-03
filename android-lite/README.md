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

The Android build uses immutable raw-GitHub copies of the exact SVG and bootstrap manifest so wrapper generation does not depend on an unreleased web deployment.

## Permanent signing identity

The production certificate SHA-256 fingerprint is pinned in `twa-manifest.production.json` and `public/.well-known/assetlinks.json`.

The private keystore and password must never be committed. The production keystore is PKCS#12, so Bubblewrap uses the same password for store and private-key access. The release workflow expects these protected GitHub Actions secrets:

- `KHPOS_ANDROID_KEYSTORE_B64`
- `KHPOS_ANDROID_KEYSTORE_PASSWORD`

Future Android wrapper releases must use the exact same production key. Increment `appVersionCode` and `appVersion`, then deliberately run the protected release workflow.

## Initial release gate — satisfied

The first signed production wrapper, `khpos-lite-v1.0.0`, was successfully built and published before the KSHC landing-page Android download control is exposed in production. The stable `KHP-OS-Lite.apk` asset therefore exists before the web change is merged.

The initial release validated the protected secrets, permanent signing certificate, Bubblewrap project generation, signed APK/AAB build, release packaging and GitHub publication.

## Permanent release model

`.github/workflows/android-lite-release.yml` is **manual-only** via `workflow_dispatch`. Routine web commits and normal KHP-OS product releases must not rebuild the Android shell automatically.

A new Android wrapper release is required only when the wrapper itself changes—for example package metadata, signing identity, launcher behavior, Android-specific icon/bootstrap assets, or another native wrapper concern. In that case, increment the Android version fields and deliberately dispatch the protected workflow.

The APK asset is always named `KHP-OS-Lite.apk`, allowing the KSHC landing page to use GitHub's stable `releases/latest/download` URL without another web deployment merely to change an APK link.

Production merge/deployment of the KSHC landing-page distribution controls remains a separate explicit founder-authorised action.
