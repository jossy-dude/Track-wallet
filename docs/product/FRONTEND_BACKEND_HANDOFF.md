# Frontend Backend Handoff

This document translates the current mobile UI into the data and backend hooks it expects.

It is intentionally narrow to the active v3 loop:

`SMS -> Parse -> Edit -> Approve -> Dashboard`

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

### 3. Settings And Parser Lab

Implemented in:
- `apps/mobile/src/components/SettingsSheet.tsx`
- `apps/mobile/src/hooks/useParser.ts`

Reads:
- parser preview result
- total balance
- account count
- approved count
- pending count
- unmatched count

Writes:
- `queueParsedTransaction`
- `captureUnmatchedSms`
- `seedDemoData`
- `clearAllData`

Required backend contract:
- real SMS listener input to replace manual debug entry
- real storage mode/status
- future sync status and pairing state

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

1. Replace `localStorage` persistence with the intended local-first database layer.
2. Persist raw SMS messages separately from parsed drafts and unmatched review items.
3. Add dedupe by `messageId`.
4. Add sync status, listener status, and storage health selectors for the settings surface.
5. Expand deterministic bank parsers toward parity with the Python source.
