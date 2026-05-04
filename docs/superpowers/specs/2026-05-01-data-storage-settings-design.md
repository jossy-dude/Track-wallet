# Data & Storage Settings Design

## Goal

Add a first-class `Data & Storage` destination to the mobile settings hub so the app can honestly expose local import, export, backup, and restore controls before the native authority layer is fully wired.

## Scope

- Add `Data & Storage` to the mobile settings hub.
- Build a dedicated detail page that follows the existing Terra mobile settings language.
- Make browser-preview-safe actions real where possible:
  - export finance data as JSON
  - create a backup snapshot as JSON
  - restore a backup snapshot created by the app
  - load a historical import package and apply it through the existing `importHistoricalData()` store flow
- Persist default import policy locally on the device:
  - import mode
  - duplicate handling mode
  - recent review days
- Keep unsupported areas clearly marked as `Coming soon`:
  - duplicate review inbox
  - reconciliation queue
  - native mobile SQLite authority

## UX Shape

### Storage Status

Show the current truth:
- browser preview storage
- export and backup are available
- desktop backfill is the preferred heavy-import path

Include compact counters for:
- approved entries
- pending review entries
- unmatched rows
- accounts

### Default Import Policy

Expose the modes already present in the backend model:
- `Back up, then replace`
- `Merge`
- `Replace`

Expose duplicate handling:
- `Skip duplicates`
- `Review duplicates` as a disabled coming-soon choice

Expose recent-days review routing:
- `0`
- `10`
- `20`
- `30`
- `45`

### Export & Backup

Real actions:
- export finance data
- create backup snapshot
- load backup package
- restore backup package after preview

### Historical Package Import

Accept a desktop-generated JSON package containing:
- parsed drafts
- optional unmatched rows

After a package loads:
- preview detected account lanes
- let the user override recent review days per detected account key
- apply the import through the existing historical import service
- auto-download the pre-import backup when `backup_then_replace` is active

### Balance Checks

Show that reported balances are already captured when present, but keep mismatch resolution as coming soon.

### Safety

Allow clearing local preview data, with copy that warns the user to create a backup first.

## Data Boundaries

This page must not claim:
- that native SQLite is already active on mobile
- that duplicate review is fully implemented
- that reconciliation mismatches can already be resolved here
- that large historical backfills are a mobile-first workflow

## Verification

- TypeScript check for `apps/mobile`
- note the known Vite/esbuild `spawn EPERM` build blocker separately if it appears again
