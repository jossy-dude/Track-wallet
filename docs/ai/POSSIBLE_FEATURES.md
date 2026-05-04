# Possible Features

## Mobile

- Bottom nav alternate style activation
  - Keep the current working bottom nav design live as-is. Do not remove it.
  - After the backend/state seam for nav-style switching is ready, make the alternate floating bottom-nav design genuinely switchable from the existing `bottom-nav-style` setting instead of only changing local preview visuals.
  - Use the user-provided interaction reference for the alternate style only: animated center scan button, hover lift / magnetic feel around the center action, active item coloring, and a preserved gap around the center action.
  - Adapt the effect to the real repo stack and current nav primitives in `packages/ui/src/components/BottomNavBar.tsx` and the existing setting flow in `apps/mobile/src/preferences/displayPreferences.ts` plus `apps/mobile/src/screens/SettingsDetailScreen.tsx`; do not paste the reference code literally.
  - Acceptance bar: changing the nav style setting must change the live mobile navbar behavior and appearance, not just the settings-card illustration.
