# Android Internal Alpha Runbook

This runbook is the release-truth baseline for the Android internal alpha candidate verified on 2026-05-04. The current lane is ready for unsigned artifact sharing plus host-level release preflight. It is not honest to claim install-level QA yet because no device or emulator is available in this workspace.

## Current Blocking CI Gates

These are the only commands that should be treated as release-blocking for the current candidate:

| Gate | Command | 2026-05-04 truth | What it proves |
| --- | --- | --- | --- |
| Workspace typecheck | `cmd /c npm run ci:typecheck` | Pass | TypeScript compile health across the workspace for the current candidate |
| Release test suite | `cmd /c npm run ci:test` | Pass | The current release-gate test suite passes for the shared workspace |
| Mobile web build | `cmd /c npm run ci:build:mobile` | Pass | The mobile app still produces a production Vite bundle for the shared shell |
| Android release artifact build | `cmd /c npm run ci:build:android:release` | Pass | The unsigned Android release artifact lane succeeds for this candidate |

## 2026-05-04 Candidate Truth

- Release scope: Android internal alpha only. Desktop is dormant and not part of release readiness.
- Artifact path: `apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk`
- Artifact existence: verified present in the workspace
- Metadata source: `apps/mobile/android/app/build/outputs/apk/release/output-metadata.json`
- Android application ID: `com.omnisync.mobile`
- Version code: `2`
- Version name: `0.1.0-alpha.1`
- Artifact truth: unsigned APK sharing is acceptable for this lane; signed release support now exists in Gradle, and a signed-requested build fails with an explicit missing-input message when keystore inputs are absent
- Signing truth: no signed artifact is proven in this session because keystore inputs were not available
- Android host tooling truth: `cmd /c npm run android:doctor -w @omni-sync/mobile` and `cmd /c npm run android:targets -w @omni-sync/mobile` are now repo-native and verified on this host
- Device QA truth: `adb` exists at `$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`, but there are no attached devices
- Emulator QA truth: no emulator binary is present at `$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe`
- Install preflight truth: `cmd /c npm run android:install:debug -w @omni-sync/mobile` now fails fast with a clear no-target message instead of implying QA happened
- Offline asset truth: `packages/ui/src/theme.css` no longer imports Material Symbols from Google Fonts at runtime; shared icons render from bundled local SVG assets
- Security settings truth: mobile security preferences now persist through the shared local authority store instead of plain WebView `localStorage`, but native biometric prompts and secure-secret enforcement are still pending
- Known non-blocking warnings:
  - `cmd /c npm run ci:build:mobile` still emits the existing chunk-size warning
  - `cmd /c npm run ci:build:android:release` still emits the existing Android SDK XML warning
- Release conclusion: ready to share the unsigned APK internally, not ready to claim install-level validation

## GitHub Automation Truth

- Baseline CI workflow: `.github/workflows/ci-baseline.yml`
- Prerelease workflow: `.github/workflows/android-alpha-prerelease.yml`
- CI default: the baseline and tag-triggered prerelease lanes build and publish the unsigned Android alpha artifact unless signing is explicitly requested.
- Signed prerelease truth: the prerelease workflow only attempts a signed artifact when a maintainer manually runs `workflow_dispatch` with `signed_release=true` and provides the required GitHub secrets for the keystore plus passwords.
- Release automation truth: GitHub prereleases can now carry the APK and `output-metadata.json`, but that automation still does not prove install-level QA, permission behavior, or Play readiness.

## Ready For Internal Alpha

- [x] `cmd /c npm run ci:typecheck` passed for the candidate being documented.
- [x] `cmd /c npm run ci:test` passed for the candidate being documented.
- [x] `cmd /c npm run ci:build:mobile` passed for the candidate being documented.
- [x] `cmd /c npm run ci:build:android:release` passed for the candidate being documented.
- [x] `cmd /c npm run android:doctor -w @omni-sync/mobile` confirms the real host has the Android SDK, `adb`, and `avdmanager`, but no emulator binary.
- [x] `cmd /c npm run android:targets -w @omni-sync/mobile` confirms there are no connected targets and no configured AVDs in this workspace.
- [x] The unsigned release artifact exists at `apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk`.
- [x] `output-metadata.json` confirms `applicationId` `com.omnisync.mobile`, `versionCode` `2`, and `versionName` `0.1.0-alpha.1`.
- [x] Shared UI no longer depends on a runtime Google Fonts Material Symbols import; icons are bundled locally.
- [x] Mobile security settings no longer persist in plain WebView `localStorage`.
- [x] The release statement is honest for this lane: Android-only internal alpha, ready for unsigned artifact sharing, not a signed or Play-ready release.
- [ ] Install-level QA on a physical Android device is still pending because `adb` currently has no attached devices.
- [ ] Emulator install/smoke QA is still pending because no emulator binary exists at `$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe`.
- [ ] Signing, Play Console upload, and upgrade-path validation remain deferred.

## Script Truth Notes

- Root `lint` is only `typecheck`. Do not treat it as an ESLint-style lint pass.
- Root `test` is still a workspace fan-out (`turbo run test`). It is useful for discovery, but it is not the release gate for this lane.
- Root `ci:build:android:release` is the workflow-safe entry point for the unsigned Android artifact lane.
- `@omni-sync/mobile` now exposes repo-native Android host helpers: `android:doctor`, `android:targets`, `android:install:debug`, and `android:smoke:debug`.
- `android:install:debug` and `android:smoke:debug` are honest preflight commands. They exit early with a clear message if no connected target is available.
- Signed release builds are opt-in. Request them by setting `trackWalletReleaseSigningEnabled=true` or `TRACK_WALLET_RELEASE_SIGNING_ENABLED=true` plus the four keystore inputs: `trackWalletReleaseStoreFile`, `trackWalletReleaseStorePassword`, `trackWalletReleaseKeyAlias`, `trackWalletReleaseKeyPassword` or their `TRACK_WALLET_RELEASE_*` environment-variable equivalents.
- If signed release signing is requested without those inputs, Gradle now fails immediately with an explicit missing-input message instead of silently producing an unsigned artifact.
- `@omni-sync/desktop` currently prints `No desktop tests yet` and is outside the Android internal alpha lane.
- `@omni-sync/ui` now includes a focused `MaterialSymbol` assertion file that passes under the package test runner.
- `@omni-sync/mobile-sms-capture` does not yet have a runtime unit-test harness; its current `test` script is compile-only and is covered by `ci:typecheck`, not by `ci:test`.

## Still Deferred After This Candidate

- Real keystore material, signed-artifact verification, and secret management
- Play Console upload or store-distribution automation
- Physical-device install, upgrade, and SMS capture QA
- Emulator-based install and smoke QA
- Desktop-native alpha packaging or release readiness
- Real cross-device sync or pairing transport validation

Add those only after the Android host/bootstrap lane has a device or emulator available and ownership for signing and distribution is in place.
