# Track Wallet

Track Wallet is the repository for **Omni-Sync SMS Finance v3.0**:
a privacy-first, local-first SMS parser and expense tracker.

## Core Goal

Capture SMS transaction alerts, parse them locally, place them into an approval inbox, and turn approved entries into a clean personal finance dashboard without sending raw financial data to the cloud by default.

## Phase 1 Architecture

- **The Listener**: background SMS capture for 5-6 bank and wallet templates
- **The Inbox**: a staging area where parsed SMS entries wait for user edits and approval
- **Local-First Storage**: SQLite-backed device storage
- **The Sync Hub**: local or peer-to-peer sync to the desktop dashboard

## Stack

- React
- TypeScript
- Capacitor for mobile
- Tauri for desktop

## UI Direction

- Floating modern bottom navigation
- Top-right settings entry
- Detached, feature-rich edit modal

## Product Scope

This repo is currently focused on the core path only:

`SMS -> Parse -> Edit -> Approve -> Dashboard`

For the canonical scope document, see [docs/product/SOURCE_OF_TRUTH.md](docs/product/SOURCE_OF_TRUTH.md).
