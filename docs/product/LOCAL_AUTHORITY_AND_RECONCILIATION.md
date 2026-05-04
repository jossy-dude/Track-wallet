# Local Authority And Reconciliation

## Goal

Move the app from a browser-local Zustand authority to a durable local-first finance authority that can:

- preserve raw SMS evidence
- preserve parser/inbox review state
- preserve approved ledger transactions
- store the bank-reported remaining balance whenever a message provides it
- compare computed balance vs reported balance on every balance-bearing event
- surface unresolved differences as reconciliation items instead of silently absorbing them

## Locked decisions

- SQLite is the target long-term authority.
- Drizzle is the schema and migration layer.
- Current implementation truth:
  - `web` still uses the compatibility path backed by browser-local storage
  - `memory` is available for tests and temporary authority work
  - `native_mobile` currently persists local state through a sql.js-backed document store and should not be described as completed file-backed native SQLite authority yet
- Money is stored in integer minor units only.
- Primary transaction direction stays:
  - `credit`
  - `debit`
  - `transfer`
- We do not create primary transaction statuses like `unknown_credit` or `unknown_debit`.
- Unexplained balance differences become `reconciliation_items` with optional resolution kinds such as:
  - `interest`
  - `bank_fee`
  - `vat_or_tax`
  - `balance_correction`
  - `missing_history`
  - `unclassified`

## Why reported balance matters

Ethiopian bank and mobile-money flows can include:

- delayed or batched interest credits
- service charges and VAT that do not always appear cleanly
- missing historical SMS
- corrected balances that do not match a simple transaction rollup

For that reason, each transaction or draft may carry `reportedBalanceMinor` when the source message includes a remaining total. The app can then compute:

- previous expected balance
- transaction delta
- expected ending balance
- reported ending balance
- difference between the two

That difference becomes an auditable reconciliation record instead of being hidden inside totals.

## Current package shape

Phase 1 and Phase 2 scaffolding now exist in `@omni-sync/database`:

- authority adapters:
  - `packages/database/src/authority/*`
- Drizzle config:
  - `packages/database/drizzle.config.ts`
- SQLite schema and mode/client helpers:
  - `packages/database/src/sqlite/*`
- first reconciliation calculator:
  - `packages/database/src/services/reconciliation-service.ts`

The live store is still the current Zustand compatibility layer in `packages/database/src/transaction-store.ts`, but shared domain types and parser output now carry explicit `reportedBalanceMinor` values so the migration path stays consistent.

Today that means:

- browser/web preview still hydrates through the compatibility store
- native mobile uses `packages/database/src/sqlite/*` to keep local authority state on-device
- deeper repository write-through and fully native SQLite/file authority remain follow-up work

## Next implementation steps

## Historical import model

Historical import is intentionally different from the live mobile review flow.

- Desktop is the preferred place for large backfills such as 3 to 5k historical SMS/data rows.
- Mobile stays focused on forward capture and day-to-day approval.
- Historical imports mostly land directly in the ledger.
- A configurable recent tail can still go to review, measured in days instead of transaction count.
- Recent-day review can vary by imported account or bank.

Planned import options:

- `merge`
- `replace`
- `backup_then_replace`

Planned duplicate handling:

- `skip`
- `review`

Planned account handling during import:

- match an existing account when possible
- otherwise create an inferred/new account entry during import

## Next implementation steps

1. Add repository implementations for raw messages, drafts, accounts, transactions, and reconciliation items.
2. Add historical import service with merge/replace/backup and recent-days review controls.
3. Introduce bootstrapped authority selection in app startup.
4. Move the compatibility store from direct localStorage truth to repository-backed truth.
