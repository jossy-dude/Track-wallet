# Store Hardening Follow-Up

This note is the post-alpha hardening backlog for the current `Track Wallet v3` repo state. It only records items already visible in code or release docs today.

## Packaging & Distribution

- **Required before wider beta/store:** Own real keystore material and prove the signed Android artifact end to end. The repo now has an opt-in release `signingConfig` lane with explicit missing-input guards, but this session still only proved the unsigned artifact path because no keystore inputs were available.
  Evidence: `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`, `apps/mobile/android/app/build.gradle`, `apps/mobile/package.json`

- **Recommended later:** Turn on release shrinking/obfuscation only after the signed lane is stable and mapping ownership is clear. The current release build still ships with `minifyEnabled false`.
  Evidence: `apps/mobile/android/app/build.gradle`

## Runtime & Security

- **Required before wider beta/store:** Pair the new authority-backed security preference storage with real native enforcement. The biometric and 2-step choices now persist through the shared local authority store, but the settings UI still honestly says native biometric prompts, secure-secret handling, and transport-backed revocation are not implemented yet.
  Evidence: `apps/mobile/src/preferences/securityPreferences.ts`, `apps/mobile/src/screens/SettingsDetailScreen.tsx`

- **Required before wider beta/store:** Validate the SMS-capture permission path against real-device behavior and distribution policy. The mobile SMS plugin currently adds `android.permission.RECEIVE_SMS` and an exported `SMS_RECEIVED` receiver, so policy, disclosure, and runtime behavior need proof beyond CI.
  Evidence: `packages/mobile-sms-capture/android/src/main/AndroidManifest.xml`, `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`

- **Recommended later:** Collapse the remaining device-local preference fragments into a clearer native persistence boundary. Profile, display, parser, storage, setup, and advanced runtime preferences still use separate local-only paths in the mobile shell.
  Evidence: `apps/mobile/src/preferences/accountPreferences.ts`, `apps/mobile/src/preferences/displayPreferences.ts`, `apps/mobile/src/preferences/parserPreferences.ts`, `apps/mobile/src/preferences/storagePreferences.ts`, `apps/mobile/src/preferences/setupPreferences.ts`, `apps/mobile/src/screens/SettingsDetailScreen.tsx`

## Offline & Assets

- **Recommended later:** Audit icon coverage and fallback usage across broader UI states before wider beta/store. Material Symbols now render from bundled local SVG assets, but some less-common names are intentionally aliased and unknown future names fall back to a local badge.
  Evidence: `packages/ui/src/components/MaterialSymbol.tsx`, `packages/ui/src/components/materialSymbolRegistry.tsx`, `packages/ui/src/theme.css`

- **Recommended later:** Audit operator-only defaults that should not survive into public builds without validation, especially advanced runtime endpoints and toggles saved locally in the mobile shell.
  Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx`

## Sync & Trust

- **Required before wider beta/store:** Keep sync and pairing read-only until a transport-backed auth/verification lane exists, or implement that lane before wider distribution. The current product docs say sync transport is not active, the mobile settings UI labels the entire surface as local preview only, and trusted-device rows are explicitly described as preview data.
  Evidence: `docs/product/SOURCE_OF_TRUTH.md`, `apps/mobile/src/screens/SettingsDetailScreen.tsx`, `apps/mobile/src/screens/SettingsDetailScreen.test.tsx`

- **Recommended later:** Remove preview-oriented trust seeds from non-alpha flows once live transport exists. The store still initializes sync defaults and a generated pairing code in local state for the modeled experience.
  Evidence: `packages/database/src/transaction-store.ts`

## QA & Device Validation

- **Required before wider beta/store:** Add candidate-level install, cold launch, resume, upgrade, and permission QA on real Android hardware. The repo now has doctor, target discovery, and install/smoke preflight commands, but the current host still has no attached device or runnable emulator target.
  Evidence: `apps/mobile/android/tools/android-host.mjs`, `apps/mobile/package.json`, `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`, `docs/product/SOURCE_OF_TRUTH.md`, `docs/ai/WORK_LOG.md`

- **Recommended later:** Add a repeatable Android smoke harness after the manual baseline is stable. The repo now has host preflight and target-selection helpers, but not committed device automation that proves the permission/resume path on actual hardware or emulator images.
  Evidence: `apps/mobile/android/tools/android-host.mjs`, `apps/mobile/package.json`, `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`
