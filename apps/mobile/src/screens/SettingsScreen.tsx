import { MaterialSymbol } from "@omni-sync/ui";

import {
  settingsHubSections,
  type SettingsCategory,
  type SettingsPageId,
} from "./settingsHubContent";

interface SettingsScreenProps {
  onOpenManageAccount: () => void;
  onOpenPage: (pageId: SettingsPageId) => void;
}

const accentClassMap: Record<
  SettingsCategory["accent"],
  {
    iconWrap: string;
    iconColor: string;
  }
> = {
  primary: {
    iconWrap: "bg-primary-container/70",
    iconColor: "text-primary",
  },
  secondary: {
    iconWrap: "bg-secondary-container",
    iconColor: "text-secondary",
  },
  tertiary: {
    iconWrap: "bg-tertiary-container",
    iconColor: "text-tertiary",
  },
  neutral: {
    iconWrap: "bg-surface-container-high",
    iconColor: "text-on-surface-variant",
  },
};

export function SettingsScreen({
  onOpenManageAccount,
  onOpenPage,
}: SettingsScreenProps) {
  function renderCategoryButton(
    category: SettingsCategory & {
      id: Exclude<SettingsPageId, "help" | "connect-device">;
    },
    isLast: boolean,
  ) {
    const accentClass = accentClassMap[category.accent];

    return (
      <button
        className={`group flex w-full items-center gap-4 px-4 py-4 text-left transition duration-200 active:scale-[0.99] ${
          isLast ? "" : "border-b border-outline-variant/20"
        }`}
        key={category.id}
        onClick={() => onOpenPage(category.id)}
        type="button"
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 ${accentClass.iconWrap}`}
        >
          <MaterialSymbol
            className={`text-[22px] ${accentClass.iconColor}`}
            filled
            name={category.icon}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-on-surface">
            {category.title}
          </div>
          <div className="mt-1 text-sm text-on-surface-variant">
            {category.description}
          </div>
        </div>
        <MaterialSymbol
          className="text-[22px] text-outline transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
          name="chevron_right"
        />
      </button>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Preferences
        </p>
        <h1 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
          Settings Hub
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
          Manage your preferences, security, and system tools from one mobile
          hub. Each destination is now its own tappable page instead of an inline
          control slab.
        </p>
      </header>

      <article className="relative overflow-hidden rounded-[28px] border border-outline-variant/20 bg-surface-container p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-fixed/45 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-surface bg-surface text-primary shadow-sm">
              <MaterialSymbol className="text-[28px]" filled name="person" />
            </div>
            <div className="min-w-0">
              <h2 className="font-headline text-2xl font-semibold text-on-surface">
                Local profile
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Device-level identity, privacy, and account preferences for
                this mobile workspace.
              </p>
            </div>
          </div>

          <button
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-outline-variant/40 bg-surface px-5 py-3 text-sm font-semibold text-primary transition active:scale-[0.99]"
            onClick={onOpenManageAccount}
            type="button"
          >
            Manage Account
          </button>
        </div>
      </article>

      {settingsHubSections.map((section) => (
        <section className="space-y-3" key={section.id}>
          <h2 className="px-1 font-headline text-lg font-semibold text-on-surface-variant">
            {section.title}
          </h2>
          <div className="overflow-hidden rounded-[28px] border border-outline-variant/20 bg-surface-container-low shadow-[0_2px_10px_rgba(46,50,48,0.03)]">
            {section.categories.map((category, index) =>
              renderCategoryButton(
                category as SettingsCategory & {
                  id: Exclude<SettingsPageId, "help" | "connect-device">;
                },
                index === section.categories.length - 1,
              ),
            )}
          </div>
        </section>
      ))}

      <div className="grid gap-4">
        <button
          className="rounded-[28px] border border-tertiary-container/50 bg-tertiary-container/30 p-5 text-left shadow-[0_4px_20px_rgba(46,50,48,0.04)] transition hover:bg-tertiary-container/40 active:scale-[0.99]"
          onClick={() => onOpenPage("help")}
          type="button"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container text-on-tertiary-container">
            <MaterialSymbol className="text-[24px]" filled name="menu_book" />
          </div>
          <h3 className="mt-4 font-headline text-xl font-semibold text-on-surface">
            Help and documentation
          </h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            Open the help center for parsing guides, setup references, and
            device/security documentation.
          </p>
        </button>
      </div>
    </section>
  );
}
