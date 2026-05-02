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
    title: "Account",
    description: "Identity, membership, and workspace profile controls",
    icon: "person",
    accent: "primary",
    detailEyebrow: "Account workspace",
    detailSummary:
      "This destination is already wired. Send the account-page design next and it can replace this placeholder directly.",
    detailHighlights: [
      "Profile identity",
      "Membership and billing",
      "Workspace ownership",
    ],
  },
  appearance: {
    id: "appearance",
    title: "Appearance",
    description: "Theme, typography, and visual density preferences",
    icon: "palette",
    accent: "secondary",
    detailEyebrow: "Visual system",
    detailSummary:
      "This is the landing point for future appearance controls once you send that page design.",
    detailHighlights: [
      "Theme and color mode",
      "Typography scale",
      "Spacing and density",
    ],
  },
  security: {
    id: "security",
    title: "Security & Privacy",
    description: "Biometrics, PIN, and personal data protections",
    icon: "security",
    accent: "secondary",
    detailEyebrow: "Trust controls",
    detailSummary:
      "The route exists now so the detailed security design can drop in without changing mobile navigation again.",
    detailHighlights: [
      "Biometric unlock",
      "PIN and device lock",
      "Local privacy controls",
    ],
  },
  dataStorage: {
    id: "dataStorage",
    title: "Data & Storage",
    description: "Import, export, backup, and local data controls",
    icon: "database",
    accent: "tertiary",
    detailEyebrow: "Local data",
    detailSummary:
      "Manage imports, exports, backups, and local authority over stored data and history.",
    detailHighlights: [
      "Import and export",
      "Backups and recovery",
      "Local history controls",
    ],
  },
  sync: {
    id: "sync",
    title: "Sync & Devices",
    description: "Connected devices, nearby discovery, and pairing flows",
    icon: "sync",
    accent: "secondary",
    detailEyebrow: "Connected surfaces",
    detailSummary:
      "This destination replaces the previous inline sync panel so the actual sync page can become its own focused screen.",
    detailHighlights: [
      "Nearby device discovery",
      "Trusted device management",
      "Manual and automatic sync",
    ],
  },
  parsing: {
    id: "parsing",
    title: "Parsing Engine",
    description: "Parser templates, extraction rules, and review tooling",
    icon: "code",
    accent: "primary",
    detailEyebrow: "Parser controls",
    detailSummary:
      "The old parser lab is removed from the hub. This placeholder marks where the dedicated parsing page will live.",
    detailHighlights: [
      "Template families",
      "Rule diagnostics",
      "Review and debugging tools",
    ],
  },
  forwarding: {
    id: "forwarding",
    title: "SMS Forwarding",
    description: "Message capture, transport handoff, and forwarding status",
    icon: "sms",
    accent: "primary",
    detailEyebrow: "Capture pipeline",
    detailSummary:
      "This route is ready for the forwarding design and keeps the hub honest as a category launcher only.",
    detailHighlights: [
      "Forwarding state",
      "Transport readiness",
      "Capture diagnostics",
    ],
  },
  advanced: {
    id: "advanced",
    title: "Advanced",
    description: "Logs, developer tools, and experimental runtime controls",
    icon: "settings_suggest",
    accent: "neutral",
    detailEyebrow: "Developer tools",
    detailSummary:
      "Use this destination for the deeper runtime and diagnostics page when you hand it over.",
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
    title: "General",
    categories: [
      settingsCategories.appearance,
      settingsCategories.security,
      settingsCategories.dataStorage,
      settingsCategories.sync,
    ],
  },
  {
    id: "system",
    title: "System Integration",
    categories: [
      settingsCategories.parsing,
      settingsCategories.forwarding,
      settingsCategories.advanced,
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
