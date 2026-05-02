# Work Log

## 2026-05-01
- Replaced the old inline mobile settings slab with a navigation-first settings hub in `apps/mobile/src/screens/SettingsScreen.tsx`.
- Added dedicated mobile settings detail pages for appearance, security, parsing, SMS forwarding, sync, device pairing, help, and advanced runtime controls in `apps/mobile/src/screens/SettingsDetailScreen.tsx`.
- Replaced the old `insights` tab with a transaction-first `ledger` tab and replaced the old account carousel screen with an account-management page in `apps/mobile/src/screens/LedgerScreen.tsx` and `apps/mobile/src/screens/CardsScreen.tsx`.
- Updated the mobile shell in `apps/mobile/src/App.tsx` so settings routes can open nested pages and return from `Connect Device` back into `Sync`.
- Verified mobile UI changes with `npm run test -w @omni-sync/mobile` and `npm run build -w @omni-sync/mobile`.
- Added a code-aware mobile UX audit for the settings/accounts/ledger redesign in `docs/ai/2026-05-01-mobile-ux-audit-settings-accounts-ledger-redesign.md`.
- Turned Help into an actual documentation surface with category guides plus realistic FAQ accordions in `apps/mobile/src/screens/settingsHelpContent.ts` and `apps/mobile/src/screens/SettingsDetailScreen.tsx`.
- Added save/check animations, local status toasts, a focused parser editor overlay, and a stateful code-based device pairing flow in `apps/mobile/src/screens/SettingsDetailScreen.tsx`.
- Wired sync management actions into the real mobile store so nearby pairing, primary-route promotion, trusted-device removal, and manual refresh all do something visible from the UI.
- Downgraded misleading settings/account credibility chrome by removing fake live status/profile signals and relabeling accounts toward tracked balances instead of net worth.
- Added a first-class `Data & Storage` mobile settings page in `apps/mobile/src/screens/DataStoragePage.tsx`, wired it into the hub, and made browser-safe export, backup, restore, and historical-import staging actions real while keeping duplicate review, reconciliation, and native SQLite paths clearly marked as coming soon.
- Added local import-policy preferences for `merge | replace | backup_then_replace`, duplicate behavior, and recent-days review defaults in `apps/mobile/src/preferences/storagePreferences.ts`.
- Verified the new `Data & Storage` surface with `npx tsc -p apps/mobile/tsconfig.json --noEmit`; the full Vite build is still blocked by the existing Windows `spawn EPERM` environment issue.
- Reworked the mobile parser settings surface into a tabbed parser workspace with template groups, sandbox testing, diagnostics, parser-pack import/export controls, and a focused editor flow in `apps/mobile/src/screens/SettingsDetailScreen.tsx`.
- Added real local parser-workspace hydration/persistence in `apps/mobile/src/preferences/parserPreferences.ts` so parser templates and parser-control toggles now survive page reloads instead of only living in-screen state.
- Updated parser settings coverage in `apps/mobile/src/screens/SettingsDetailScreen.test.tsx` and verified the screen with `cmd /c npx tsc -p apps/mobile/tsconfig.json --noEmit` plus `cmd /c npm run test -w @omni-sync/mobile -- SettingsDetailScreen.test.tsx`.

## 2026-05-02
- Remapped the `Data & Storage` mobile settings page in `apps/mobile/src/screens/DataStoragePage.tsx` onto the user-provided management layout with `Database Management`, storage health, `Data Integrity`, and `Logging` cards while preserving the existing export, backup, restore, import, and destructive-clear behavior.
- Kept the deeper `Historical Import`, reported-balance tracking, reconciliation placeholder, and native-authority boundary panels intact so the redesign stays honest about what is real versus still backend-dependent.
- Re-verified the parser/storage settings slice with `cmd /c npm run test -w @omni-sync/mobile -- SettingsDetailScreen.test.tsx` and `cmd /c npx tsc -p apps/mobile/tsconfig.json --noEmit`.
