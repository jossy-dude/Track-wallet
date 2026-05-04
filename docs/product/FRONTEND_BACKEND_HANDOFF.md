# Frontend Backend Handoff

This document translates the current mobile UI into the data and backend hooks it expects.

It is intentionally narrow to the active v3 loop:

`SMS -> Parse -> Edit -> Approve -> Dashboard`

Desktop is intentionally out of the live alpha loop for this handoff. Any sync or pairing references below describe the current mobile UI/state model, not a shipped desktop transport lane.

## Current Frontend Surfaces

### 1. Home

Implemented in:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `packages/ui/src/components/BalanceSummaryCard.tsx`
- `packages/ui/src/components/AccountCarousel.tsx`
- `packages/ui/src/components/BudgetLimitCard.tsx`
- `packages/ui/src/components/InboxPanel.tsx`

Reads:
- `approvalQueue`
- `approvedTransactions`
- `accountSummaries`
- `budgetSummaries`
- `buildDashboardSnapshot()`

Required backend contract:
- approved-only account balances
- approved-ledger-derived budget summaries
- count of pending inbox items
- balance-by-channel snapshot

### 2. Inbox

Implemented in:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/InboxScreen.tsx`
- `packages/ui/src/components/InboxPanel.tsx`
- `packages/ui/src/components/EditTransactionModal.tsx`
- `apps/mobile/src/components/UnmatchedSmsPanel.tsx`

Reads:
- `approvalQueue`
- `unmatchedMessages`
- `activeQueueEntryId`

Writes:
- `openTransactionEditor`
- `editApprovalQueueItem`
- `approveQueueItem`
- `dismissUnmatchedSms`

Required backend contract:
- queue entries must preserve the raw SMS body
- queue entries must preserve parser source/template identity
- approval must move the item into the approved ledger without mutating dashboard balances beforehand
- unmatched raw messages must remain visible and dismissible without being mistaken for approved data

### 3. Ledger

Implemented in:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/LedgerScreen.tsx`

Reads:
- `approvedTransactions`
- `budgetSummaries`
- `buildDashboardSnapshot()`

Required backend contract:
- approved-ledger-derived income/outflow/net-flow metrics
- recent approved transaction feed suitable for a transaction-first ledger surface
- category totals that continue matching approved ledger state

### 4. Accounts

Implemented in:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/CardsScreen.tsx`

Reads:
- `accountSummaries`
- `approvedTransactions`
- `buildDashboardSnapshot()`

Required backend contract:
- account balances grouped from approved ledger state
- stable institution/account identity for grouped account rows
- balance-by-channel data for allocation insight

### 5. Settings Hub And Detail Pages

Implemented in:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/screens/SettingsDetailScreen.tsx`
- `apps/mobile/src/screens/settingsHubContent.ts`
- `apps/mobile/src/hooks/useParser.ts`

Reads:
- parser preview result
- `syncEnabled`
- `syncMode`
- `syncDiscoveryState`
- `syncStatusSummary`
- `nearbySyncDevices`
- `trustedSyncDevices`
- `syncActivity`
- `pairingCodeState`

Writes:
- `queueParsedTransaction`
- `captureUnmatchedSms`
- `toggleSyncEnabled`
- `setSyncMode`
- `startSyncDiscovery`
- `stopSyncDiscovery`
- `pairNearbyDevice`
- `updatePairingCodeInput`
- `submitPairingCode`
- `markTrustedDeviceAsPrimary`
- `removeTrustedDevice`
- `triggerManualSync`

Required backend contract:
- the SMS listener/bridge path already exists; the remaining gap is making host/runtime coverage, permission-state handling, and backfill/history behavior consistently feed the same inbox/review pipeline instead of relying on manual-only fallback paths
- real local storage health/status surfaces for the active mobile authority path
- modeled trusted-device and pairing state that stays honest about not being a live cross-device protocol yet
- sync actions that remain local-first UI state until a real transport lane exists
- device-local settings/account persistence only for this alpha; any cross-device or profile-backed settings work is post-alpha

## Current Store Boundary

The current canonical store layers are:
- `approvalQueue`
- `approvedTransactions`
- `unmatchedMessages`
- `accountSummaries`
- `budgetSummaries`

Immediate rule:
- `approvalQueue` is the staging area
- `approvedTransactions` is the ledger
- `unmatchedMessages` is the raw parser-review lane
- account and dashboard values must reflect approvals, not pending drafts

## Current Parser Boundary

The parser currently accepts:
- `RawSmsMessage`

It currently returns:
- `ParserMatchResult`
- `ParsedTransactionDraft`

The UI expects every matched result to provide:
- institution
- direction
- amount
- running balance when available
- title
- category
- parser template id
- confidence
- account reference when available

## Backend Work Still Needed

1. Continue converging preview/browser persistence with the more advanced mobile local authority path without claiming a finished SQLite-backed authority before it exists.
2. Persist raw SMS messages separately from parsed drafts and unmatched review items.
3. Add dedupe by `messageId`.
4. Keep sync status, listener status, and storage health selectors honest about the difference between modeled UI state and a real transport/runtime path.
5. Expand deterministic bank parsers toward parity with the Python source.
