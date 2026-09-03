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

The desktop PWA and Android Lite shell use raster exports of the exact existing KSHC favicon artwork from `src/app/icon.svg`: the blue rounded square, white health pulse and green dot. No alternate KHP-OS app mark is permitted unless the product identity is deliberately changed later.

## Permanent signing identity

The production certificate SHA-256 fingerprint is pinned in `twa-manifest.production.json` and `public/.well-known/assetlinks.json`.

The private keystore and password must never be committed. The production keystore is PKCS#12, so Bubblewrap uses the same password for store and private-key access. The release workflow expects these protected GitHub Actions secrets:

- `KHPOS_ANDROID_KEYSTORE_B64`
- `KHPOS_ANDROID_KEYSTORE_PASSWORD`

Future Android wrapper releases must use the exact same production key. Increment `appVersionCode` and `appVersion`, then run the protected release workflow.

## Release model

`.github/workflows/android-lite-release.yml` builds a signed APK and AAB with Bubblewrap and publishes a GitHub Release. The APK asset is always named `KHP-OS-Lite.apk`, allowing the KSHC landing page to use GitHub's stable `releases/latest/download` URL without another web deployment merely to change an APK link.

Do not merge a landing-page Android download button into production before the first signed `KHP-OS-Lite.apk` release exists.
