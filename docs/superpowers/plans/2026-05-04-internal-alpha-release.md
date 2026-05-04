# Internal Alpha Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an honest Android-only internal-alpha candidate for `Track Wallet v3` with verified gates, an unsigned APK artifact, release-truth docs, and an explicit store-hardening follow-up list.

**Architecture:** Treat this as a release-train pass, not a feature pass. The core loop and mobile authority work are already in place; the remaining work is to verify the Android artifact lane, record exact candidate truth, and separate alpha-ready scope from deferred store-hardening work.

**Tech Stack:** Turborepo, React, TypeScript, Capacitor Android, Vitest, Turbo, Vite, local docs in `docs/release` and `docs/ai`

---

### Task 1: Verify Candidate Gates

**Files:**
- Modify: `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`
- Modify: `docs/ai/WORK_LOG.md`

- [ ] **Step 1: Run the release gates**

Run:

```bash
cmd /c npm run ci:typecheck
cmd /c npm run ci:test
cmd /c npm run ci:build:mobile
cmd /c npm run ci:build:android:release
```

Expected:
- all commands exit `0`
- Android release build produces `apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk`

- [ ] **Step 2: Confirm artifact metadata**

Run:

```bash
Get-Content apps/mobile/android/app/build/outputs/apk/release/output-metadata.json
```

Expected:
- `applicationId` is `com.omnisync.mobile`
- `versionCode` is `2`
- `versionName` is `0.1.0-alpha.1`
- output file is `app-release-unsigned.apk`

- [ ] **Step 3: Confirm device/emulator truth**

Run:

```bash
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
Test-Path "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
```

Expected:
- no attached devices if the session still has none
- emulator binary may be absent

- [ ] **Step 4: Record release truth**

Update:
- `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`
- `docs/ai/WORK_LOG.md`

Include:
- exact gates that passed
- exact artifact path
- device/emulator availability truth
- non-blocking warnings that remain

### Task 2: Publish Internal Alpha Readiness

**Files:**
- Modify: `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`

- [ ] **Step 1: Add a ready-state checklist**

Add a short section covering:
- verified gates
- unsigned artifact truth
- Android-only release lane
- missing install/resume/permission QA because no target is attached
- sync/pairing modeled-state truth

- [ ] **Step 2: Keep honesty boundaries explicit**

The checklist must not claim:
- signed release readiness
- Play Store readiness
- desktop participation
- live sync transport
- device QA that did not happen

### Task 3: Create Store Hardening Follow-Up

**Files:**
- Create: `docs/release/STORE_HARDENING_FOLLOW_UP.md`

- [ ] **Step 1: Capture the hardening backlog**

Record items grounded in repo truth:
- unsigned APK and signing/distribution ownership
- no install-level device QA in this session
- runtime Material Symbols fetch from Google Fonts in `packages/ui/src/theme.css`
- modeled sync/pairing without real transport
- remaining mobile build chunk-size warning

- [ ] **Step 2: Split by priority**

Use two groups:
- required before wider beta/store
- recommended after internal alpha

- [ ] **Step 3: Add cross-links**

Cross-link the hardening doc from:
- `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`

### Task 4: Final Verification

**Files:**
- Modify: `docs/release/ANDROID_INTERNAL_ALPHA_RUNBOOK.md`
- Modify: `docs/ai/WORK_LOG.md`
- Create: `docs/release/STORE_HARDENING_FOLLOW_UP.md`

- [ ] **Step 1: Re-read the final docs for consistency**

Check:
- dates are `2026-05-04`
- gate truth matches command results
- internal-alpha wording stays narrower than store-ready wording

- [ ] **Step 2: Confirm final repo state**

Run:

```bash
git status --short
```

Expected:
- release docs and any already-intended tracked files show as modified
- no accidental unrelated revert
