# Track Wallet Mobile UX Audit

Date: 2026-05-01

## Scope

This audit is based on direct code inspection of the current mobile surface, not on old roadmap assumptions.

Reviewed code:
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/InboxScreen.tsx`
- `apps/mobile/src/screens/LedgerScreen.tsx`
- `apps/mobile/src/screens/CardsScreen.tsx`
- `apps/mobile/src/screens/SettingsScreen.tsx`
- `apps/mobile/src/screens/SettingsDetailScreen.tsx`
- `apps/mobile/src/screens/settingsHubContent.ts`
- `apps/mobile/src/hooks/useParser.ts`
- `apps/mobile/src/components/ActivityFeed.tsx`
- `apps/mobile/src/components/MetricCard.tsx`
- `apps/mobile/src/components/UnmatchedSmsPanel.tsx`
- `packages/ui/src/components/TopAppBar.tsx`
- `packages/ui/src/components/BottomNavBar.tsx`
- `packages/ui/src/components/InboxPanel.tsx`
- `packages/ui/src/components/InboxTransactionItem.tsx`
- `packages/ui/src/components/EditTransactionModal.tsx`
- `packages/database/src/transaction-store.ts`

Reviewed docs:
- `docs/ai/WORK_LOG.md`
- `docs/product/SOURCE_OF_TRUTH.md`
- `docs/product/FRONTEND_BACKEND_HANDOFF.md`

Important limitation:
- This is a code-aware UX/product audit. It is not a runtime emulator pass, touch pass, or device-permission QA pass.

## Executive Summary

The redesign moved the mobile app in a better structural direction. The old "everything in one slab" settings surface is now more scannable, the ledger tab is a better IA fit than a vague insights tab, and inbox approval still reads as the real center of the product loop.

The current problem is credibility, not ambition. Too many surfaces now look production-ready while still behaving like staged prototypes. The settings detail stack is the clearest example: security, forwarding, help, and advanced pages present real-looking controls for sensitive operations, but most of those controls are local-only or dead. At the same time, the app auto-seeds demo financial/device data on first load, persists to `localStorage` instead of the promised database layer, and uses a fixed pairing code in store state. The result is a UI that visually signals trust and backend maturity faster than the underlying product has earned.

If this app is meant to be taken seriously as a local-first finance product, the next pass should prioritize honesty over breadth: hide or downgrade fake-complete controls, remove misleading account/sync language, and only keep surfaces live where the state model is real.

## Current Strengths

- The settings redesign fixed the previous discoverability problem. The hub is easy to scan and the section grouping is clearer than an inline control slab. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:85-192`.
- The app shell cleanly separates `home`, `inbox`, `ledger`, and `accounts`, and the settings flow can now open nested pages such as `connect-device` from `sync`. Evidence: `apps/mobile/src/App.tsx:169-173`, `apps/mobile/src/App.tsx:450-500`, `apps/mobile/src/App.tsx:540-558`.
- The ledger replacement is directionally correct. "Approved transactions" is a clearer promise than a generic insights surface, and it keeps the app tied to the approval pipeline. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:29-91`.
- Inbox still expresses the product truth well: parsed items wait for approval, unmatched SMS stays visible, and the edit modal remains available before ledger write. Evidence: `apps/mobile/src/screens/InboxScreen.tsx:39-112`, `apps/mobile/src/components/UnmatchedSmsPanel.tsx:21-69`, `packages/ui/src/components/EditTransactionModal.tsx:47-170`.
- The parser settings page is the one settings detail surface that actually connects to live mobile behavior. `Queue to Inbox` uses the real parser hook and opens the inbox review flow. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:480-537`, `apps/mobile/src/hooks/useParser.ts:34-95`.
- Sync state is at least modeled centrally rather than screen-local. The sync page reads shared store state and some actions update that shared state. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1126-1145`, `packages/database/src/transaction-store.ts:502-959`.

## Top-Priority Findings

### P0: The app overstates product completeness in trust-sensitive areas

The most serious UX problem is not visual polish. It is that several screens imply live, secure infrastructure while still being mock-like or disconnected:

- Security actions such as `Configure Biometrics`, `Revoke`, `Sign out of all devices`, and `Save Changes` do not have handlers. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:373-378`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:446-463`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:468-474`.
- Forwarding settings are local component state only. `Save Configuration` is dead. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:715-829`.
- Help search, browse categories, and featured articles are styled as real content but are not wired to anything. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:832-940`.
- Advanced settings expose API keys, webhooks, and dangerous actions, but the page is entirely presentational and local-state based. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1438-1663`.

For a finance app, fake-complete security/admin surfaces are worse than missing surfaces. They teach the user to trust controls that currently do nothing.

### P0: Demo mode is visually indistinguishable from product reality

On first load, the mobile app seeds demo finance and device data if nothing exists. Evidence: `apps/mobile/src/App.tsx:200-213`, `packages/database/src/transaction-store.ts:430-463`.

That creates a major truth problem:
- dashboard balances look real before any SMS capture exists
- accounts and device sync appear configured before the user has done any setup
- the redesigned ledger/accounts/settings pages can be mistaken for verified end-to-end behavior

This is especially risky because the same app also persists to `localStorage`, not the promised SQLite/local-first database layer. Evidence: `packages/database/src/transaction-store.ts:135-140`, `packages/database/src/transaction-store.ts:1065-1083`; compare with `docs/product/SOURCE_OF_TRUTH.md:24` and `docs/product/FRONTEND_BACKEND_HANDOFF.md:166-170`.

### P1: Accounts IA is misleading and drifts from the actual product model

The accounts redesign visually reads like a bank-linking product, but the current data model is still rebuilt from approved SMS/ledger state:

- `Link New Account` is a dead CTA and implies institution-linking capability the app does not currently have. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:116-123`.
- The empty state says accounts are rebuilt from approved SMS, which directly contradicts the CTA above it. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:116-123`, `packages/ui/src/components/AccountCarousel.tsx:34-36`.
- `Total Net Worth` overclaims what the surface can actually know. The app is showing tracked balances, not a full net worth model with liabilities and external assets. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:96-114`.

### P1: Navigation is still stateful UI switching, not robust mobile navigation

The redesign introduced nested settings pages, but navigation is still managed by booleans and tab state inside `App.tsx`, not a route/back-stack system. Evidence: `apps/mobile/src/App.tsx:170-173`, `apps/mobile/src/App.tsx:450-470`, `apps/mobile/src/App.tsx:533-558`.

Practical impact:
- hardware/back-stack behavior is not explicitly modeled
- settings depth is encoded manually through `getSettingsPageParent`, and only `connect-device` has a parent today
- future nested settings pages will be brittle unless real routing is introduced

### P1: Important store capabilities exist but are not exposed in the mobile UI

The store already supports more lifecycle control than the UI exposes:
- `rejectQueueItem`
- `markTrustedDeviceAsPrimary`
- `removeTrustedDevice`
- `clearAllData`

Evidence: `packages/database/src/transaction-store.ts:73-88`, `packages/database/src/transaction-store.ts:796-874`, `packages/database/src/transaction-store.ts:1013-1061`.

This leaves core flows half-finished:
- inbox users can approve or edit, but not reject from the primary surface
- trusted devices can be shown as removable/manageable, but the buttons on the sync UI are dead
- there is no visible way to promote a primary authority route even though the store supports it

## Detailed Findings

### IA and Navigation

- The settings hub hero has a `Manage account` CTA, but account management is not actually inside settings. It jumps to the bottom-nav accounts tab instead. That creates a split IA: account identity feels like settings, but account operations live elsewhere. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:124-130`.
- `settingsHubContent.ts` still defines an `account` settings category, but the live settings hub does not render it. This shows the IA is still unresolved. Evidence: `apps/mobile/src/screens/settingsHubContent.ts:3-16`, `apps/mobile/src/screens/settingsHubContent.ts:34-49`, `apps/mobile/src/screens/settingsHubContent.ts:142-160`.
- Sync and Connect Device duplicate nearby-device discovery. Users see nearby devices on Sync, then tap through to another nearby-device list on Connect Device. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1329-1431`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1072-1116`.
- The parsing page includes an in-content back arrow button with no behavior, even though the app shell already renders a top-bar back action for settings. This is both redundant and broken. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:541-565`.
- The inbox also has a secondary `tune` entry point into settings in addition to the top app bar gear. That can be useful, but right now it reads as duplicate entry rather than purposeful context navigation. Evidence: `apps/mobile/src/screens/InboxScreen.tsx:52-58`.

### Home

- Home is still the most coherent overview surface, but it is heavily dependent on shared components that now duplicate later screens. `Your Accounts`, `Inbox`, and `Recently Approved` all reappear in more dedicated forms elsewhere. Evidence: `apps/mobile/src/screens/HomeScreen.tsx:44-79`.
- There is no first-run guidance on Home for the real start of the product loop: grant SMS access, confirm listener status, or parse first message. Empty child components explain absence, but the screen does not guide setup.
- The home surface currently inherits seeded/demo truth if the store is empty, which undermines its value as a trustworthy command center. Evidence: `apps/mobile/src/App.tsx:200-213`.

### Inbox

- The inbox summary card is strong and product-specific. It is one of the better rewritten sections. Evidence: `apps/mobile/src/screens/InboxScreen.tsx:39-91`.
- The primary inbox list only supports `Modify` and `Approve`. There is no reject/archive action even though the store supports queue rejection. Evidence: `packages/ui/src/components/InboxTransactionItem.tsx:80-98`, `packages/database/src/transaction-store.ts:1013-1022`.
- The unmatched SMS panel surfaces raw messages well, but parser failure reasons are not shown even though unmatched store entries keep them. Evidence: `apps/mobile/src/components/UnmatchedSmsPanel.tsx:31-69`, `packages/database/src/transaction-store.ts:485-493`.
- When parser queueing fails to match, the user is redirected to Inbox, but there is no focus jump or visual emphasis to the newly captured unmatched entry. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:519-537`.

### Ledger

- The ledger rewrite is conceptually correct, but the current page still behaves more like a summary dashboard than a ledger. It shows top metrics, a repeated recent-activity list, and a budget card, but not a browsable transaction list with date grouping, filters, or ledger-specific actions. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:29-91`.
- The copy `This replaces the old insights tab` is internal transition language, not final product copy. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:38-41`.
- `Current visible balance` is vague. A ledger user needs to know whether a number reflects approved balances, inferred balances, or account-reported running balances. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:70-76`.

### Accounts

- The page now has a stronger layout than a carousel-only view, but the semantics are still off.
- `Link New Account` should not be live in the current product shape. It implies direct account connection, not SMS-derived account reconstruction. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:116-123`.
- Allocation percentages are computed by parsing the already-formatted display string back into numbers. This is fragile and will break under localization, copy changes, or alternate currency formatting. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:46-49`, `apps/mobile/src/screens/CardsScreen.tsx:81-83`, `apps/mobile/src/screens/CardsScreen.tsx:139-165`.
- Account grouping is inferred from icon choice rather than a durable account-type field. That means a visual icon change can silently change IA grouping. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:59-69`.
- The account list has no drill-down behavior, no per-account timeline, and no primary/secondary meaning beyond layout.

### Settings Hub

- The hub is visually successful, but it still includes too much ornamental confidence.
- The profile block uses a hard-coded generic user name and a remote avatar URL. For a local-first finance app, that is both impersonal and operationally suspect. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:106-120`, `apps/mobile/src/App.tsx:45-49`.
- The `System Status` panel is decorative. The live pulsing dot suggests verified runtime monitoring, but the card only states that the settings hub is navigation-first. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:152-174`.
- The CTA copy should be plural: `Manage account` reads unfinished next to an entire `Accounts` tab. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:124-130`.

### Settings Detail Pages

#### Appearance

- The page is visually polished but purely local state. Theme, accent, typography, and density selections do not read/write persisted product settings. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:123-318`.
- Accent selection is especially misleading because `appearanceAccents` already has one hard-coded selected swatch and clicking other swatches does not change selection state. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:47-53`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:243-260`.

#### Security

- The page uses strong visual language for security-critical operations, but almost everything beyond the switch animation is dead or local-only. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:320-477`.
- `Revoke` only becomes visible on hover. On touch-first mobile, that is effectively hidden. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:423-451`.
- The page implies device-level identity control, but it only reads `trustedSyncDevices` and local booleans. There is no OS biometric status, no auth confirmation, and no destructive confirmation flow.

#### Parsing

- This page is the closest to a real tool, but it still mixes internal tooling language with consumer settings IA.
- The page title `SMS Parsing Logic`, the code block, and the regex reference all read like a developer workbench, not a normal mobile settings surface. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:539-709`.
- `Save` is dead, and the code block is static. The only real action is `Queue to Inbox`. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:559-565`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:567-593`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:651-658`.

#### Forwarding

- The page makes strong promises about routing and trusted desktop authority, but all state is component-local. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:715-829`.
- The destination input is also semantically confusing because the field already includes `+251` as a fixed prefix while the default value still contains the full country code. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:719`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:800-809`.

#### Help

- This page should be hidden until content exists. It currently presents search, categories, and featured articles that do not open anything. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:832-940`.
- The current design creates the expectation of a knowledge system that the product does not yet ship.

#### Connect Device

- Manual code entry is the best-realized part of the pairing flow because it actually uses store actions. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:948-977`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1033-1069`.
- `Open Scanner` is dead. That makes the QR path decorative rather than usable. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:990-1022`.
- The screen does not show pairing-code expiry even though the store tracks `expiresAt`. Evidence: `packages/database/src/transaction-store.ts:150-156`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:956-969`.
- Nearby devices can be paired here, but there is no notion of pairing progress, confirmation, or failure beyond code-entry errors.

#### Sync

- This page has the right overall shape, but it still overstates authority health.
- `Refresh Status` actually triggers local sync-state changes, but there is no surfaced activity log, handshake detail, or payload result. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1296-1303`, `packages/database/src/transaction-store.ts:875-959`.
- Trusted-device cards show `Manage` and `Disconnect`, but both buttons are dead. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1376-1382`.
- Nearby-device cards show `Connect`, but that action only opens the connect-device page instead of directly pairing or clearly explaining why another step is required. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1413-1419`.
- The page reads `syncActivity` only to compute the latest sync summary. The richer activity trail never appears in the UI. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1151-1152`.

#### Advanced

- This page should not be live in its current form.
- API keys, webhooks, and danger-zone actions make the app look enterprise-complete, but the page is disconnected from real authority/runtime systems. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1438-1663`.
- `AI Categorization` is shown as a live switch even though the detail literally says `Coming soon`. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1607-1613`.
- Finance users should not see dead infrastructure controls unless the product explicitly labels the page as internal/debug-only.

## Wording and Copy Issues

- `Total Net Worth` is incorrect for a tracked-balance screen. Use something like `Tracked balance` or `Total tracked balance`. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:97-113`.
- `Link New Account` implies bank-linking capability that does not exist. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:116-123`.
- `Manage account` should be `Manage accounts`, and ideally should point to a real account-settings surface or be removed. Evidence: `apps/mobile/src/screens/SettingsScreen.tsx:124-130`.
- `Inbox staging area` and `Approval queue` are engineering-facing terms. The product can keep one of them, but using both increases system-jargon density. Evidence: `apps/mobile/src/screens/InboxScreen.tsx:42-49`.
- `This replaces the old insights tab` is internal transition copy, not product copy. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:38-41`.
- `Current visible balance`, `Lead balance`, `Sources`, `Primary Route`, `Trusted route`, and `mobile vault instance` all read more like implementation language than user-facing finance language. Evidence: `apps/mobile/src/screens/LedgerScreen.tsx:70-76`, `apps/mobile/src/screens/CardsScreen.tsx:103-113`, `apps/mobile/src/screens/InboxScreen.tsx:76-82`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1171-1237`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1462-1468`.

## Accessibility Concerns

- Several icon-only buttons do not expose accessible labels:
  - inbox settings/tune button
  - unmatched-message dismiss buttons
  - advanced-page copy/delete buttons
  - parsing in-content back button
  Evidence: `apps/mobile/src/screens/InboxScreen.tsx:52-58`, `apps/mobile/src/components/UnmatchedSmsPanel.tsx:53-60`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:543-548`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1511-1516`.
- `SwitchButton` uses `role="switch"` and `aria-checked`, but it does not receive an accessible name from `aria-label` or `aria-labelledby`. Depending on screen reader interpretation, several toggles may be announced ambiguously. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:95-120`.
- Appearance theme choices and accent swatches do not expose selected-state semantics such as `aria-pressed`, `aria-selected`, or radio-group behavior. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:155-260`.
- The hover-only `Revoke` affordance is not appropriate for touch-first mobile. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:446-450`.
- Critical state differences often rely on color and ornament first, text second. Examples include allocation bars, health dots, and active route badges. Those need stronger textual fallback.

## Error, Empty, and Loading State Gaps

- There are effectively no loading states anywhere in the redesign. Everything renders as if data is instantly available.
- There are no SMS-permission, listener-disabled, storage-failure, or sync-handshake error states even though the product depends on those system boundaries. Compare `docs/product/FRONTEND_BACKEND_HANDOFF.md:124-128` with the current settings UI.
- Pairing exposes only one inline error: wrong or incomplete code. It does not surface expiry, timeout, scanner permission denial, or network unavailability. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1058-1061`.
- Help has no no-results state because search is not wired.
- Sync has no visible empty-state guidance until the bottom of the page, even though the top half still presents active system posture cards. Evidence: `apps/mobile/src/screens/SettingsDetailScreen.tsx:1166-1327`, `apps/mobile/src/screens/SettingsDetailScreen.tsx:1426-1430`.

## Backend-Readiness Concerns Caused by Current UI Assumptions

- The product docs still say the app is SQLite/local-first, but the current mobile store persists to `localStorage`. Evidence: `docs/product/SOURCE_OF_TRUTH.md:24`, `packages/database/src/transaction-store.ts:135-140`, `packages/database/src/transaction-store.ts:1065-1083`.
- The app seeds demo devices, balances, and sync history, which makes sync/admin UI feel ready before a backend authority exists. Evidence: `packages/database/src/transaction-store.ts:430-463`.
- The fixed pairing code (`284913`) is not acceptable for a security-signaling pairing UX. Evidence: `packages/database/src/transaction-store.ts:150-156`, `packages/database/src/transaction-store.ts:1053-1058`.
- Sync actions mutate local store summaries and timestamps, but the UI language implies real network authority checks. Evidence: `packages/database/src/transaction-store.ts:502-959`.
- Accounts page math is derived from formatted strings and icon heuristics rather than stable backend fields. That will create brittle behavior once localization or richer account metadata arrives. Evidence: `apps/mobile/src/screens/CardsScreen.tsx:46-69`, `apps/mobile/src/screens/CardsScreen.tsx:81-83`.
- The docs are already drifting. `SOURCE_OF_TRUTH.md` still describes the earlier settings model and does not reflect the new settings hub / ledger / account-management structure. Evidence: `docs/product/SOURCE_OF_TRUTH.md:30-32`.

## Features That Should Be Added

- A real first-run setup sequence for SMS permission, listener status, and "what happens next".
- Inbox rejection/archive actions, since queue rejection already exists in store.
- A real sync activity timeline surface, not just a last-sync summary.
- Pairing expiry, regenerate/resend, and scanner-permission states on Connect Device.
- Per-account drill-down or at least a lightweight account detail sheet from the accounts list.
- Explicit distinction between demo mode, empty live mode, and connected live mode if demo seeding remains during development.
- Clear save/dirty/success/error states for any settings page that intends to persist anything.

## Features and Components That Should Be Removed or Consolidated

- Hide or gate the Advanced page until API keys, webhook endpoints, and destructive actions are real.
- Hide or downgrade Help until articles and search are navigable.
- Remove `Link New Account` until direct account-linking actually exists, or rename it to match the SMS-first product model.
- Remove the in-content back button from Parsing, since the shell already owns settings back navigation.
- Remove the decorative `System Status` ping card from Settings Hub unless it reads real health data.
- Consolidate account access into one clear IA decision: either accounts are a main tab only, or there is a real account settings destination. The current hybrid is muddy.
- Consolidate nearby-device pairing. Do not make users see the same nearby devices on Sync and Connect Device without a strong reason.
- Consolidate repeated `recent approved` activity modules across Home, Inbox, Ledger, and Accounts if those sections are not materially different.

## Recommended Priority Order

1. Remove or relabel trust-breaking dead controls on Security, Forwarding, Help, Sync, Accounts, and Advanced.
2. Stop presenting seeded demo data as ordinary product state, or visibly label demo mode.
3. Wire missing store-backed lifecycle actions into the UI: reject queue item, remove trusted device, set primary device, and clear data if needed.
4. Replace local UI-route booleans with a real mobile navigation model before the settings tree grows.
5. Add first-run, empty, loading, and error states around SMS capture, sync, and pairing.
6. Only then broaden deeper settings/admin surfaces.

## Bottom Line

The redesign improved structure, but the app is still strongest when it stays close to the SMS -> inbox -> approve -> ledger loop. The more it moves into "platform" language without real backing state, the less trustworthy it becomes. The next mobile pass should optimize for product honesty: fewer fake-complete controls, stronger setup/error states, and cleaner IA around accounts and sync authority.
