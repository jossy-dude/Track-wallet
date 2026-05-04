# Track Wallet v3

This document is the canonical source of truth for the initial product scope.

## Project

- Name: Track Wallet
- Version: 0.1.0-alpha.1
- Goal: A privacy-first, local-first SMS parser and expense tracker.
- Stack: React + TypeScript + Capacitor (active mobile alpha) + Tauri (future desktop shell work, not a live alpha lane)

## Core Architecture (Phase 1)

### 1. The Listener

A background service that intercepts SMS messages from 5-6 different bank and wallet templates.

### 2. The Staging Area (Inbox)

A "To-Be-Approved" queue where raw SMS data waits for user titles, categories, and notes.

### 3. Local-First Storage

Keep finance data local by default. Current preview/browser flows still persist through browser-local storage, while the active mobile runtime uses a more advanced local authority path. That mobile authority is further along than a plain preview store, but this repo should still not claim a finished SQLite-backed authority yet.

### 4. Sync And Pairing Surfaces

The current alpha exposes sync and pairing UI/state, but it should be treated as modeled or simulated state for product shaping. The repo does not currently ship an active desktop-participating sync transport for the internal alpha.

## Current Alpha Release Truth

- The current active release lane is Android-only.
- Android internal-alpha builds currently produce an unsigned APK artifact.
- The Android app display name is `Track Wallet`.
- Desktop is intentionally dormant for the current alpha and does not participate in the live core loop.
- Desktop may still build as a web shell, but there is no real desktop-native alpha lane yet.
- Sync/pairing transport is not active; current sync state is not a live cross-device protocol.
- Physical-device install, resume, and permission validation remain release-process work, not CI truth.

## UI/UX Constraints

- Navigation: Floating/Hovering Modern Bottom Nav Bar
- Settings: Top-right gear icon (non-nav)
- The "Edit" Window: Detached, feature-rich hovering modal
