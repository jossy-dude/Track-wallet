# Track Wallet

Track Wallet v3 is a privacy-first, local-first SMS parser and expense tracker for the current Android-only internal-alpha release lane.

## Core Goal

Capture SMS transaction alerts, parse them locally, place them into an approval inbox, and turn approved entries into a clean personal finance dashboard without sending raw financial data to the cloud by default.

## Phase 1 Architecture

- **The Listener**: background SMS capture for 5-6 bank and wallet templates
- **The Inbox**: a staging area where parsed SMS entries wait for user edits and approval
- **Local-First Storage**: the active mobile runtime already uses a more advanced local authority path than browser `localStorage`, but it should not be described as a finished SQLite-backed authority yet
- **Sync And Pairing Surfaces**: current settings/state are modeled for the alpha UI, not a live cross-device transport protocol

## Stack

- React
- TypeScript
- Capacitor for mobile
- Tauri for future desktop work, not for a live internal-alpha lane

## UI Direction

- Floating modern bottom navigation
- Top-right settings entry
- Detached, feature-rich edit modal

## Product Scope

This repo is currently focused on the core path only:

`SMS -> Parse -> Edit -> Approve -> Dashboard`

## Current Alpha Truth

- Android is the only active release lane in this repo today.
- Desktop is intentionally dormant for the current alpha and does not participate in the live core loop.
- Desktop may still build as a web shell, but there is no real desktop-native alpha lane yet.
- Android release builds can currently produce an unsigned internal-alpha APK.
- The shipped Android display name is `Track Wallet`.
- Sync and pairing UI should be treated as modeled state, not as an active local-network or peer-to-peer transport.
- The mobile runtime uses a local authority path beyond browser preview storage, but it is still not a finished SQLite-backed authority.

For the canonical scope document, see [docs/product/SOURCE_OF_TRUTH.md](docs/product/SOURCE_OF_TRUTH.md).
