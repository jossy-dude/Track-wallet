import type { MaterialSymbolName } from "@omni-sync/ui";

export type SettingsCategoryId =
  | "account"
  | "appearance"
  | "security"
  | "sync"
  | "dataStorage"
  | "parsing"
  | "forwarding"
  | "advanced";

export type SettingsPageId =
  | SettingsCategoryId
  | "help"
  | "connect-device";

export interface SettingsCategory {
  id: SettingsCategoryId;
  title: string;
  description: string;
  icon: MaterialSymbolName;
  accent: "primary" | "secondary" | "tertiary" | "neutral";
  detailEyebrow: string;
  detailSummary: string;
  detailHighlights: readonly string[];
}

export interface SettingsCategorySection {
  id: string;
  title: string;
  categories: readonly SettingsCategory[];
}

const settingsCategories: Record<SettingsCategoryId, SettingsCategory> = {
  account: {
    id: "account",
    title: "Local profile",
    description: "Name, privacy status, and export posture",
    icon: "person",
    accent: "primary",
    detailEyebrow: "This phone",
    detailSummary:
      "Name saves locally now, while privacy and export toggles stay clearly framed as device defaults until enforcement lands.",
    detailHighlights: [
      "Profile identity",
      "Privacy defaults",
      "Export controls",
    ],
  },
  appearance: {
    id: "appearance",
    title: "Appearance",
    description: "Theme, density, and showcase",
    icon: "palette",
    accent: "secondary",
    detailEyebrow: "Visual system",
    detailSummary:
      "Save the live device-level appearance choices now, while theme and density previews stay clearly gated for alpha honesty.",
    detailHighlights: [
      "Theme mode",
      "Typography scale",
      "Spacing and density",
    ],
  },
  security: {
    id: "security",
    title: "Security & Privacy",
    description: "Lock, biometrics, and privacy",
    icon: "security",
    accent: "secondary",
    detailEyebrow: "Trust controls",
    detailSummary:
      "Save a local unlock plan and review device posture without pretending OS enforcement or remote revocation is already live.",
    detailHighlights: [
      "Biometric unlock",
      "PIN and device lock",
      "Privacy rules",
    ],
  },
  dataStorage: {
    id: "dataStorage",
    title: "Data & Storage",
    description: "Import, export, backup, and clear",
    icon: "database",
    accent: "tertiary",
    detailEyebrow: "Local data",
    detailSummary: "Import, backup, restore, and local data cleanup.",
    detailHighlights: [
      "Import and export",
      "Backups and recovery",
      "Local history controls",
    ],
  },
  sync: {
    id: "sync",
    title: "Sync & Devices",
    description: "Discovery, trusted devices, and pairing",
    icon: "sync",
    accent: "secondary",
    detailEyebrow: "Connected surfaces",
    detailSummary:
      "Inspect local sync posture and preview device state from one route while transport-backed discovery and pairing stay hidden.",
    detailHighlights: [
      "Nearby discovery",
      "Trusted devices",
      "Manual sync",
    ],
  },
  parsing: {
    id: "parsing",
    title: "Parsing Engine",
    description: "Template workspace and parser diagnostics",
    icon: "code",
    accent: "neutral",
    detailEyebrow: "System internals",
    detailSummary:
      "Built-in templates, account bindings, preview, and parser diagnostics for internal review.",
    detailHighlights: [
      "Template families",
      "Account bindings",
      "Preview and diagnostics",
    ],
  },
  forwarding: {
    id: "forwarding",
    title: "SMS Capture & Routing",
    description: "Capture runtime and routing diagnostics",
    icon: "sms",
    accent: "neutral",
    detailEyebrow: "System internals",
    detailSummary:
      "Capture runtime, sender rules, queue, and diagnostics for internal setup work.",
    detailHighlights: [
      "Runtime state",
      "Queue routing",
      "Diagnostics",
    ],
  },
  advanced: {
    id: "advanced",
    title: "Advanced",
    description: "Logs and staged runtime tools",
    icon: "settings_suggest",
    accent: "neutral",
    detailEyebrow: "Developer tools",
    detailSummary: "Diagnostics, logs, and staged runtime controls.",
    detailHighlights: [
      "Runtime diagnostics",
      "Logs and traces",
      "Experimental toggles",
    ],
  },
};

export const settingsHubSections: readonly SettingsCategorySection[] = [
  {
    id: "general",
    title: "Preferences",
    categories: [
      settingsCategories.appearance,
      settingsCategories.security,
      settingsCategories.dataStorage,
      settingsCategories.sync,
    ],
  },
  {
    id: "system",
    title: "System internals",
    categories: [
      settingsCategories.parsing,
      settingsCategories.forwarding,
    ],
  },
];

export function getSettingsCategory(
  categoryId: SettingsCategoryId,
): SettingsCategory {
  return settingsCategories[categoryId];
}

export function getSettingsPageTitle(pageId: SettingsPageId): string {
  if (pageId === "help") {
    return "Help Center";
  }

  if (pageId === "connect-device") {
    return "Connect Device";
  }

  return getSettingsCategory(pageId).title;
}

export function getSettingsPageParent(
  pageId: SettingsPageId,
): SettingsPageId | null {
  if (pageId === "connect-device") {
    return "sync";
  }

  return null;
}
