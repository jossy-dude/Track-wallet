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
