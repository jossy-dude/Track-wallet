# Local SQLite Authority And Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current localStorage-backed Zustand authority with a typed SQLite-backed authority that preserves raw SMS, inbox drafts, approved transactions, reported balances, and reconciliation state so the app can compare calculated balance vs bank-reported balance on every transaction.

**Architecture:** Keep the current UI-facing store API shape for now, but move persistence and accounting truth into `@omni-sync/database` repositories and services. The schema must preserve event history instead of flattening everything into one transactions table: raw messages, inbox drafts, authoritative posted transactions, reconciliation items, budgets, and trusted devices all need their own tables. Reported balances are stored per event when available and used by a reconciliation service to detect unexplained deltas such as interest, service charges, VAT, or missing history. Because the repo is still browser-first for preview, the rollout must be adapter-first: browser preview gets a browser-safe authority adapter, tests get a memory adapter, and native mobile gets file-backed SQLite later under the same repository boundary.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, sql.js or browser-safe SQLite adapter for preview, future native SQLite adapter, Vitest, Zustand compatibility layer.

---

## Planned file structure

### Core domain files

- Modify: `packages/core/src/types.ts`
  - Expand transaction/reconciliation domain types.
- Modify: `packages/core/src/index.ts`
  - Export any new shared types.

### Database authority files

- Modify: `packages/database/package.json`
  - Add Drizzle and SQLite dependencies plus scripts.
- Create: `packages/database/drizzle.config.ts`
  - Drizzle migration config.
- Create: `packages/database/src/authority/types.ts`
  - Shared authority adapter and repository contracts.
- Create: `packages/database/src/authority/web-authority-adapter.ts`
  - Browser-safe preview authority implementation.
- Create: `packages/database/src/authority/memory-authority-adapter.ts`
  - Test adapter.
- Create: `packages/database/src/authority/native-sqlite-adapter.ts`
  - Deferred native-only boundary for later Capacitor SQLite wiring.
- Create: `packages/database/src/sqlite/schema.ts`
  - Drizzle table definitions.
- Create: `packages/database/src/sqlite/mode.ts`
  - Real vs demo authority mode selection.
- Create: `packages/database/src/sqlite/client.ts`
  - Database bootstrap and adapter selection.
- Create: `packages/database/src/sqlite/repositories/raw-message-repository.ts`
- Create: `packages/database/src/sqlite/repositories/inbox-draft-repository.ts`
- Create: `packages/database/src/sqlite/repositories/transaction-repository.ts`
- Create: `packages/database/src/sqlite/repositories/reconciliation-repository.ts`
- Create: `packages/database/src/sqlite/repositories/account-repository.ts`
- Create: `packages/database/src/sqlite/repositories/budget-repository.ts`
- Create: `packages/database/src/sqlite/repositories/device-repository.ts`
- Create: `packages/database/src/services/reconciliation-service.ts`
- Create: `packages/database/src/services/transaction-service.ts`
- Create: `packages/database/src/services/legacy-import-service.ts`
- Modify: `packages/database/src/index.ts`
  - Export new authority modules.
- Modify: `packages/database/src/transaction-store.ts`
  - Convert the current store into a compatibility shell backed by repositories.

### Database tests

- Create: `packages/database/src/sqlite/schema.test.ts`
- Create: `packages/database/src/services/reconciliation-service.test.ts`
- Create: `packages/database/src/services/legacy-import-service.test.ts`
- Modify: `packages/database/src/transaction-store.test.ts`
  - Move assertions toward repository-backed behavior.

### App integration files

- Modify: `apps/mobile/src/App.tsx`
  - Initialize authority mode and first-run import.
- Create: `apps/mobile/src/providers/storageModeContext.tsx`
  - UI-level real/demo mode provider only, not the authority itself.
- Modify: `apps/mobile/src/preferences/displayPreferences.ts`
  - Keep UI prefs separate from finance authority data.

### Docs

- Modify: `docs/ai/WORK_LOG.md`
- Create: `docs/product/LOCAL_AUTHORITY_AND_RECONCILIATION.md`

---

## Domain decisions locked before implementation

- Money stays in integer minor units only:
  - `amount_minor`
  - `fee_minor`
  - `vat_minor`
  - `service_fee_minor`
  - `other_fees_minor`
  - `reported_balance_minor`
  - `computed_balance_minor`
  - `delta_minor`
- `direction` remains the primary movement status:
  - `credit`
  - `debit`
  - `transfer`
- We do **not** create primary transaction kinds called `unknown_credit` or `unknown_debit`.
- Instead, unexplained balance differences go into `reconciliation_items` with a `resolution_kind` such as:
  - `interest`
  - `bank_fee`
  - `vat_or_tax`
  - `balance_correction`
  - `missing_history`
  - `unclassified`
- Every transaction or draft may store `reported_balance_minor` when the SMS includes a balance.
- If the SMS does not include a balance, `reported_balance_minor` stays `null`.
- Manual entries are valid first-class events and must not require SMS-specific fields.
- Empty or partial rows must be allowed where appropriate:
  - no account reference
  - no reported balance
  - no raw message
  - no parser template

---

## Target table model

### `raw_messages`

Stores the original evidence.

Key columns:

```ts
id: text("id").primaryKey()
source_hash: text("source_hash").notNull().unique()
sender_label: text("sender_label").notNull()
raw_body: text("raw_body").notNull()
received_at: integer("received_at").notNull()
source_kind: text("source_kind").$type<"sms" | "manual" | "import">().notNull()
```

### `inbox_drafts`

Stores parser/manual review state before approval.

```ts
id: text("id").primaryKey()
raw_message_id: text("raw_message_id")
queued_at: integer("queued_at").notNull()
direction: text("direction").$type<"credit" | "debit" | "transfer">().notNull()
amount_minor: integer("amount_minor").notNull()
fee_minor: integer("fee_minor").notNull().default(0)
reported_balance_minor: integer("reported_balance_minor")
currency_code: text("currency_code").notNull().default("ETB")
title: text("title").notNull()
merchant_name: text("merchant_name")
category: text("category").notNull()
account_channel: text("account_channel").notNull()
account_reference: text("account_reference")
parser_template_id: text("parser_template_id")
confidence: integer("confidence").notNull()
note: text("note").notNull().default("")
```

### `accounts`

Stores durable account identity.

```ts
id: text("id").primaryKey()
channel: text("channel").$type<"bank" | "mobile_money" | "cash">().notNull()
institution_key: text("institution_key")
institution_name: text("institution_name").notNull()
account_reference: text("account_reference")
masked_account_number: text("masked_account_number").notNull()
currency_code: text("currency_code").notNull().default("ETB")
is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false)
created_at: integer("created_at").notNull()
updated_at: integer("updated_at").notNull()
```

### `transactions`

Stores only posted authoritative ledger events.

```ts
id: text("id").primaryKey()
account_id: text("account_id").notNull()
raw_message_id: text("raw_message_id")
inbox_draft_id: text("inbox_draft_id")
occurred_at: integer("occurred_at").notNull()
approved_at: integer("approved_at").notNull()
direction: text("direction").$type<"credit" | "debit" | "transfer">().notNull()
event_kind: text("event_kind").$type<
  "approved_sms" | "manual_entry" | "opening_balance" | "balance_correction"
>().notNull()
amount_minor: integer("amount_minor").notNull()
fee_minor: integer("fee_minor").notNull().default(0)
vat_minor: integer("vat_minor").notNull().default(0)
service_fee_minor: integer("service_fee_minor").notNull().default(0)
other_fees_minor: integer("other_fees_minor").notNull().default(0)
reported_balance_minor: integer("reported_balance_minor")
title: text("title").notNull()
merchant_name: text("merchant_name")
category: text("category").notNull()
note: text("note").notNull().default("")
```

### `reconciliation_items`

Stores computed-vs-reported balance gaps.

```ts
id: text("id").primaryKey()
account_id: text("account_id").notNull()
trigger_transaction_id: text("trigger_transaction_id")
trigger_raw_message_id: text("trigger_raw_message_id")
expected_balance_minor: integer("expected_balance_minor").notNull()
reported_balance_minor: integer("reported_balance_minor").notNull()
delta_minor: integer("delta_minor").notNull()
status: text("status").$type<"pending" | "resolved" | "ignored">().notNull()
resolution_kind: text("resolution_kind").$type<
  "interest" | "bank_fee" | "vat_or_tax" | "balance_correction" | "missing_history" | "unclassified"
>()
resolved_by_transaction_id: text("resolved_by_transaction_id")
created_at: integer("created_at").notNull()
resolved_at: integer("resolved_at")
```

### Supporting tables

- `budget_rules`
- `trusted_devices`
- `sync_activity`
- optional later: `app_preferences`, `categories`

---

## Phase plan

### Phase 1: Lock the domain model before storage

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/database/src/transaction-store.test.ts`

- [ ] **Step 1: Add failing type expectations for reported balance and reconciliation-ready fields**

Add or update test/type usage so the code expects these fields to exist:

```ts
type TransactionDirection = "credit" | "debit" | "transfer";

interface ApprovedTransaction {
  reportedBalanceMinor?: number;
}

interface ReconciliationItem {
  id: string;
  accountId: string;
  expectedBalanceMinor: number;
  reportedBalanceMinor: number;
  deltaMinor: number;
  status: "pending" | "resolved" | "ignored";
  resolutionKind?:
    | "interest"
    | "bank_fee"
    | "vat_or_tax"
    | "balance_correction"
    | "missing_history"
    | "unclassified";
}
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `cmd /c .\node_modules\.bin\tsc -p packages/database/tsconfig.json --noEmit`

Expected: FAIL because the new types do not exist yet.

- [ ] **Step 3: Implement the shared types in `packages/core/src/types.ts`**

Add:
- `reportedBalanceMinor?: number` to draft and approved transaction shapes
- `ReconciliationItem`
- `AuthorityMode`
- `StorageBootstrapState` if needed for first-run import

- [ ] **Step 4: Run typecheck again**

Run: `cmd /c .\node_modules\.bin\tsc -p packages/database/tsconfig.json --noEmit`

Expected: PASS for the new type surface, or fail only on downstream repository files not yet created.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat: add reconciliation-ready domain types"
```

### Phase 2: Add authority boundary plus SQLite and Drizzle scaffolding

**Files:**
- Modify: `packages/database/package.json`
- Create: `packages/database/drizzle.config.ts`
- Create: `packages/database/src/authority/types.ts`
- Create: `packages/database/src/authority/web-authority-adapter.ts`
- Create: `packages/database/src/authority/memory-authority-adapter.ts`
- Create: `packages/database/src/sqlite/schema.ts`
- Test: `packages/database/src/sqlite/schema.test.ts`

- [ ] **Step 1: Write a failing schema smoke test**

Example:

```ts
import { describe, expect, it } from "vitest";
import { accounts, transactions, reconciliationItems } from "./schema";

describe("schema", () => {
  it("defines reconciliation-ready tables", () => {
    expect(accounts).toBeDefined();
    expect(transactions).toBeDefined();
    expect(reconciliationItems).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cmd /c npm run test -w @omni-sync/database -- schema.test.ts`

Expected: FAIL because schema files are missing.

- [ ] **Step 3: Add dependencies and scaffold the authority boundary plus schema**

Add dependencies:
- `drizzle-orm`
- `drizzle-kit`
- one browser-safe SQLite path for preview only if we decide to execute browser SQLite immediately, such as `sql.js`

Add shared authority contracts:

```ts
export type AuthorityMode = "real" | "demo";
export type AuthorityRuntime = "web" | "memory" | "native-mobile";

export interface AuthorityAdapter {
  runtime: AuthorityRuntime;
  mode: AuthorityMode;
}
```

Skeleton:

```ts
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  direction: text("direction").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  reportedBalanceMinor: integer("reported_balance_minor"),
});
```

- [ ] **Step 4: Run the schema test again**

Run: `cmd /c npm run test -w @omni-sync/database -- schema.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/package.json packages/database/drizzle.config.ts packages/database/src/sqlite
git commit -m "feat: scaffold drizzle sqlite authority"
```

### Phase 3: Build adapter and mode boundary

**Files:**
- Create: `packages/database/src/sqlite/mode.ts`
- Create: `packages/database/src/sqlite/client.ts`
- Create: `apps/mobile/src/providers/storageModeContext.tsx`
- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Write a failing mode-selection test**

The authority must expose:

```ts
type AuthorityMode = "real" | "demo";

interface AuthorityClient {
  mode: AuthorityMode;
}
```

- [ ] **Step 2: Implement a browser-safe adapter split**

Initial rule:
- browser preview uses a browser-safe authority adapter behind the repository boundary
- tests use a memory adapter
- native mobile later swaps to file-backed SQLite without changing repositories
- do not import native SQLite code from the `@omni-sync/database` root export used by desktop/browser today

- [ ] **Step 3: Keep UI context thin**

The React context only chooses mode:

```ts
const StorageModeContext = createContext<{
  mode: "real" | "demo";
  setMode: (mode: "real" | "demo") => void;
} | null>(null);
```

- [ ] **Step 4: Wire App bootstrap to choose authority mode**

The store should not inspect localStorage for finance truth anymore.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/sqlite/mode.ts packages/database/src/sqlite/client.ts apps/mobile/src/providers/storageModeContext.tsx apps/mobile/src/App.tsx
git commit -m "feat: add authority mode boundary"
```

### Phase 4: Add repositories and reconciliation service

**Files:**
- Create: `packages/database/src/sqlite/repositories/*.ts`
- Create: `packages/database/src/services/reconciliation-service.ts`
- Test: `packages/database/src/services/reconciliation-service.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Cover:
- matching reported balance produces no reconciliation item
- positive delta creates pending reconciliation item
- negative delta creates pending reconciliation item

Example:

```ts
expect(result.expectedBalanceMinor).toBe(100_00);
expect(result.reportedBalanceMinor).toBe(104_25);
expect(result.deltaMinor).toBe(4_25);
expect(result.status).toBe("pending");
```

- [ ] **Step 2: Implement the core algorithm**

Rule:

```ts
expectedBalanceMinor =
  previousComputedBalanceMinor +
  signedAmountMinor -
  feeMinor -
  vatMinor -
  serviceFeeMinor -
  otherFeesMinor;
```

If `reportedBalanceMinor` is null:
- do not create reconciliation item

If `reportedBalanceMinor !== expectedBalanceMinor`:
- create pending reconciliation row

- [ ] **Step 3: Implement classification support**

Keep `direction` as movement status.
Use `resolutionKind` only for the reconciliation outcome.

- [ ] **Step 4: Run service tests**

Run: `cmd /c npm run test -w @omni-sync/database -- reconciliation-service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/sqlite/repositories packages/database/src/services/reconciliation-service.ts packages/database/src/services/reconciliation-service.test.ts
git commit -m "feat: add reconciliation service and repositories"
```

### Phase 5: Migrate legacy persisted state and demo data

**Files:**
- Create: `packages/database/src/services/legacy-import-service.ts`
- Modify: `packages/database/src/mockData.ts`
- Modify: `packages/database/src/index.ts`
- Test: `packages/database/src/services/legacy-import-service.test.ts`

- [ ] **Step 1: Write failing import tests**

Cover:
- imports approved transactions
- imports queue items
- imports unmatched SMS
- skips duplicates by raw-message hash or stable import key

- [ ] **Step 2: Implement stable import keys**

For imported SMS:

```ts
sourceHash = sha256(`${senderLabel}|${receivedAt}|${rawBody}`);
```

For legacy non-SMS rows:
- derive stable import key from existing IDs

- [ ] **Step 3: Preserve old finance state on first boot**

The import service reads the old persisted Zustand snapshot and inserts:
- raw messages
- inbox drafts
- approved transactions
- budgets
- trusted devices

- [ ] **Step 4: Run import tests**

Run: `cmd /c npm run test -w @omni-sync/database -- legacy-import-service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/services/legacy-import-service.ts packages/database/src/services/legacy-import-service.test.ts packages/database/src/mockData.ts packages/database/src/index.ts
git commit -m "feat: add legacy state import into sqlite authority"
```

### Phase 6: Rebuild the current store as a compatibility shell

**Files:**
- Modify: `packages/database/src/transaction-store.ts`
- Modify: `packages/database/src/transaction-store.test.ts`

- [ ] **Step 1: Write failing store-integration tests**

Cover:
- `seedDemoData()` writes through the authority
- `queueParsedTransaction()` persists draft rows
- `approveQueueItem()` persists transactions and reconciliation state
- `clearAllData()` clears selected authority mode only

- [ ] **Step 2: Replace direct localStorage truth with repository reads/writes**

The public store API can stay similar for the UI, but the source of truth becomes SQLite repositories and services.

- [ ] **Step 3: Recompute summaries from authoritative rows**

Do not persist `accountSummaries` and `budgetSummaries` as primary truth if they can be derived.

- [ ] **Step 4: Run store tests**

Run: `cmd /c npm run test -w @omni-sync/database -- transaction-store.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/transaction-store.ts packages/database/src/transaction-store.test.ts
git commit -m "feat: back transaction store with sqlite authority"
```

### Phase 7: App bootstrap, docs, and guardrails

**Files:**
- Modify: `apps/mobile/src/App.tsx`
- Modify: `docs/ai/WORK_LOG.md`
- Create: `docs/product/LOCAL_AUTHORITY_AND_RECONCILIATION.md`

- [ ] **Step 1: Add first-run bootstrap states**

Handle:
- empty authority
- demo seed
- legacy import pending
- import completed

- [ ] **Step 2: Keep finance truth separate from UI preferences**

Do not merge:
- appearance preferences
- onboarding
- display toggles

with:
- finance authority

- [ ] **Step 3: Document reconciliation behavior**

Document:
- when `reportedBalanceMinor` is saved
- how expected balance is calculated
- when reconciliation items are created
- how interest and charges are later resolved

- [ ] **Step 4: Run final verification**

Run:

```bash
cmd /c .\node_modules\.bin\tsc -p apps/mobile/tsconfig.json --noEmit
cmd /c npm run test -w @omni-sync/database
cmd /c npm run test -w @omni-sync/mobile
cmd /c npm run build -w @omni-sync/mobile
```

Expected:
- typecheck passes
- repository and store tests pass
- mobile tests pass unless blocked by the known Windows Vite/esbuild `spawn EPERM` sandbox issue

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/App.tsx docs/ai/WORK_LOG.md docs/product/LOCAL_AUTHORITY_AND_RECONCILIATION.md
git commit -m "docs: record sqlite authority and reconciliation rollout"
```

---

## Initial multi-agent execution split

### Agent A: Domain and schema

Owns:
- `packages/core/src/types.ts`
- `packages/database/src/authority/types.ts`
- `packages/database/drizzle.config.ts`
- `packages/database/src/sqlite/schema.ts`

### Agent B: Repositories and reconciliation

Owns:
- `packages/database/src/sqlite/repositories/*`
- `packages/database/src/services/reconciliation-service.ts`
- related tests

### Agent C: Legacy import and authority mode

Owns:
- `packages/database/src/services/legacy-import-service.ts`
- `packages/database/src/sqlite/mode.ts`
- `packages/database/src/sqlite/client.ts`
- `packages/database/src/authority/web-authority-adapter.ts`
- `packages/database/src/authority/memory-authority-adapter.ts`
- `packages/database/src/authority/native-sqlite-adapter.ts`
- `apps/mobile/src/providers/storageModeContext.tsx`

### Agent D: Store compatibility and app bootstrap

Owns:
- `packages/database/src/transaction-store.ts`
- `packages/database/src/transaction-store.test.ts`
- `apps/mobile/src/App.tsx`

---

## Self-review

- Spec coverage:
  - reported balance recorded at transaction time: covered
  - empty/missing values allowed safely: covered
  - no fake `unknown_credit` / `unknown_debit` transaction kinds: covered
  - future interest/bank-fee classification support: covered
  - real vs demo authority split: covered
  - browser-preview versus native SQLite runtime split: covered
- Placeholder scan:
  - no `TODO` / `TBD` markers remain
- Type consistency:
  - `direction` and `resolutionKind` are intentionally separate throughout
