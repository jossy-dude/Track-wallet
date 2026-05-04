import {
  createDefaultParserTemplateWorkspace,
  findDefaultParserTemplate,
  type FinancialInstitution,
  type ParserWorkspaceAuthorityState,
  type ParserTemplateDefinition,
  type ParserTemplateStatus,
  type ParserTemplateWorkspace,
  migrateResolvedTemplatesToWorkspace,
  resolveParserTemplateWorkspace,
} from "@omni-sync/core";
import { transactionStore } from "@omni-sync/database";

const PARSER_WORKSPACE_STORAGE_KEY = "trackwallet.mobile.parser-workspace";

type LegacyParserTemplatePreferenceStatus = ParserTemplateStatus;

interface LegacyParserTemplatePreference {
  id: string;
  institutionKey: string;
  institutionLabel: string;
  institutionIcon: string;
  name: string;
  version: string;
  updated: string;
  status: LegacyParserTemplatePreferenceStatus;
  regex: string;
  note: string;
  healthScore: number | null;
  sourceType: "core" | "local";
}

interface LegacyParserWorkspacePreferenceSnapshot {
  version: 1;
  templates: LegacyParserTemplatePreference[];
  selectedTemplateId: string;
  senderLabel: string;
  strictSchemaParsing: boolean;
  preserveRawSms: boolean;
  autoReconciliation: boolean;
  verboseLogging: boolean;
}

export interface ParserWorkspacePreferenceSnapshot {
  version: 3;
  templateWorkspace: ParserTemplateWorkspace;
  selectedTemplateId: string;
  senderLabel: string;
  strictSchemaParsing: boolean;
  preserveRawSms: boolean;
  autoReconciliation: boolean;
  verboseLogging: boolean;
}

interface ParserWorkspacePreferenceSnapshotV2 {
  version: 2;
  templateWorkspace: ParserTemplateWorkspace;
  selectedTemplateId: string;
  senderLabel: string;
  strictSchemaParsing: boolean;
  preserveRawSms: boolean;
  autoReconciliation: boolean;
  verboseLogging: boolean;
}

interface ParserWorkspaceSnapshotFields {
  templateWorkspace: ParserTemplateWorkspace;
  selectedTemplateId: string;
  senderLabel: string;
  strictSchemaParsing: boolean;
  preserveRawSms: boolean;
  autoReconciliation: boolean;
  verboseLogging: boolean;
}

function canUseStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTemplateStatus(value: unknown): value is ParserTemplateStatus {
  return (
    value === "active" ||
    value === "draft" ||
    value === "fallback" ||
    value === "disabled"
  );
}

function resolveFinancialInstitution(institutionKey: string): FinancialInstitution {
  const normalized = institutionKey.trim().toLowerCase();

  if (normalized === "cbe") {
    return "cbe";
  }
  if (normalized === "boa") {
    return "boa";
  }
  if (normalized === "127" || normalized === "telebirr") {
    return "telebirr";
  }
  if (normalized === "cbebirr") {
    return "cbebirr";
  }
  if (normalized === "dashenbank" || normalized === "dashen") {
    return "dashen";
  }
  if (normalized === "bunnabank" || normalized === "bunna") {
    return "bunna";
  }

  return "unknown";
}

function buildLegacyTemplateDefinition(
  template: LegacyParserTemplatePreference,
): ParserTemplateDefinition {
  const defaultTemplate = findDefaultParserTemplate(template.id);
  if (defaultTemplate) {
    const isLocalTemplate = template.sourceType === "local";
    return {
      ...defaultTemplate,
      institutionKey: template.institutionKey,
      institutionLabel: template.institutionLabel,
      institutionIcon: template.institutionIcon,
      name: template.name,
      version: template.version,
      updated: template.updated,
      status: template.status,
      regex: template.regex,
      note: template.note,
      healthScore: template.healthScore,
      sourceType: template.sourceType,
      templateKind: isLocalTemplate ? "custom" : "builtin",
      builtInTemplateId: isLocalTemplate
        ? defaultTemplate.id
        : defaultTemplate.builtInTemplateId,
      engineEditable: isLocalTemplate,
      accountIdentifiers: [...defaultTemplate.accountIdentifiers],
      identityTextFragments: [...defaultTemplate.identityTextFragments],
      userProfile: {
        senderAliases: [...defaultTemplate.senderAliases],
        accountIdentifiers: [...defaultTemplate.accountIdentifiers],
        identityTextFragments: [...defaultTemplate.identityTextFragments],
      },
    };
  }

  const senderAliases = [template.institutionKey];
  const isLocalTemplate = template.sourceType === "local";
  return {
    id: template.id,
    financialInstitution: resolveFinancialInstitution(template.institutionKey),
    institutionKey: template.institutionKey,
    institutionLabel: template.institutionLabel,
    institutionIcon: template.institutionIcon,
    senderAliases,
    accountIdentifiers: [],
    identityTextFragments: [],
    name: template.name,
    version: template.version,
    updated: template.updated,
    status: template.status,
    regex: template.regex,
    note: template.note,
    healthScore: template.healthScore,
    sourceType: template.sourceType,
    templateKind: isLocalTemplate ? "custom" : "builtin",
    builtInTemplateId: undefined,
    engineEditable: isLocalTemplate,
    userProfile: {
      senderAliases: [...senderAliases],
      accountIdentifiers: [],
      identityTextFragments: [],
    },
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    feeKey: "fee",
    vatKey: "vat",
    accountKey: "account",
    referenceKey: "reference",
    dateKey: "date",
    timeKey: "time",
    meridiemKey: "meridiem",
    dateMode: "captured_at",
  };
}

function isLegacyTemplatePreference(
  value: unknown,
): value is LegacyParserTemplatePreference {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.institutionKey === "string" &&
    typeof value.institutionLabel === "string" &&
    typeof value.institutionIcon === "string" &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.updated === "string" &&
    isTemplateStatus(value.status) &&
    typeof value.regex === "string" &&
    typeof value.note === "string" &&
    (typeof value.healthScore === "number" || value.healthScore === null) &&
    (value.sourceType === "core" || value.sourceType === "local")
  );
}

function isParserTemplateDefinition(
  value: unknown,
): value is ParserTemplateDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.financialInstitution === "string" &&
    typeof value.institutionKey === "string" &&
    typeof value.institutionLabel === "string" &&
    typeof value.institutionIcon === "string" &&
    Array.isArray(value.senderAliases) &&
    value.senderAliases.every((alias) => typeof alias === "string") &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.updated === "string" &&
    isTemplateStatus(value.status) &&
    typeof value.regex === "string" &&
    typeof value.note === "string" &&
    (typeof value.healthScore === "number" || value.healthScore === null) &&
    (value.sourceType === "core" || value.sourceType === "local") &&
    (value.direction === "debit" ||
      value.direction === "credit" ||
      value.direction === "transfer") &&
    typeof value.amountKey === "string" &&
    (value.dateMode === "message_date" || value.dateMode === "captured_at")
  );
}

function isWorkspaceSnapshot(
  value: unknown,
): value is
  | ParserWorkspacePreferenceSnapshot
  | ParserWorkspacePreferenceSnapshotV2
  | LegacyParserWorkspacePreferenceSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    ((value.version === 1 && Array.isArray(value.templates)) ||
      ((value.version === 2 || value.version === 3) && isRecord(value.templateWorkspace))) &&
    typeof value.selectedTemplateId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.strictSchemaParsing === "boolean" &&
    typeof value.preserveRawSms === "boolean" &&
    typeof value.autoReconciliation === "boolean" &&
    typeof value.verboseLogging === "boolean"
  );
}

function normalizeWorkspaceSnapshot(
  snapshot:
    | ParserWorkspacePreferenceSnapshot
    | ParserWorkspacePreferenceSnapshotV2
    | LegacyParserWorkspacePreferenceSnapshot,
): ParserWorkspacePreferenceSnapshot | null {
  if (snapshot.version === 2 || snapshot.version === 3) {
    return buildNormalizedPreferenceSnapshot(snapshot);
  }

  let templates: ParserTemplateDefinition[] | null = null;
  const parserTemplates = snapshot.templates as unknown[];

  if (parserTemplates.every(isParserTemplateDefinition)) {
    templates = (parserTemplates as ParserTemplateDefinition[]).map((template) => ({
      ...template,
      senderAliases: [...template.senderAliases],
      accountIdentifiers: [...(template.accountIdentifiers ?? [])],
      identityTextFragments: [...(template.identityTextFragments ?? [])],
      userProfile: {
        senderAliases: [...(template.userProfile?.senderAliases ?? template.senderAliases)],
        accountIdentifiers: [
          ...(template.userProfile?.accountIdentifiers ??
            template.accountIdentifiers ??
            []),
        ],
        identityTextFragments: [
          ...(template.userProfile?.identityTextFragments ??
            template.identityTextFragments ??
            []),
        ],
      },
    }));
  } else if (parserTemplates.every(isLegacyTemplatePreference)) {
    templates = (parserTemplates as LegacyParserTemplatePreference[]).map(
      buildLegacyTemplateDefinition,
    );
  }

  if (!templates) {
    return null;
  }

  const migratedWorkspace = migrateResolvedTemplatesToWorkspace(templates);
  const resolvedTemplateIds = new Set(
    resolveParserTemplateWorkspace(migratedWorkspace).map((template) => template.id),
  );
  const selectedTemplateId = resolvedTemplateIds.has(snapshot.selectedTemplateId)
    ? snapshot.selectedTemplateId
    : templates[0]?.id ?? "";

  return {
    ...buildNormalizedPreferenceSnapshot({
      templateWorkspace: migratedWorkspace,
      selectedTemplateId,
      senderLabel: snapshot.senderLabel,
      strictSchemaParsing: snapshot.strictSchemaParsing,
      preserveRawSms: snapshot.preserveRawSms,
      autoReconciliation: snapshot.autoReconciliation,
      verboseLogging: snapshot.verboseLogging,
    }),
  };
}

function buildNormalizedPreferenceSnapshot(
  snapshot: ParserWorkspaceSnapshotFields,
): ParserWorkspacePreferenceSnapshot {
  const templateWorkspace = isRecord(snapshot.templateWorkspace)
    ? ({
        ...createDefaultParserTemplateWorkspace(),
        ...(snapshot.templateWorkspace as Partial<ParserTemplateWorkspace>),
      } as ParserTemplateWorkspace)
    : createDefaultParserTemplateWorkspace();
  const resolvedTemplates = resolveParserTemplateWorkspace(templateWorkspace);
  const resolvedTemplateIds = new Set(
    resolvedTemplates.map((template) => template.id),
  );

  return {
    version: 3,
    templateWorkspace,
    selectedTemplateId: resolvedTemplateIds.has(snapshot.selectedTemplateId)
      ? snapshot.selectedTemplateId
      : resolvedTemplates[0]?.id ?? "",
    senderLabel: snapshot.senderLabel,
    strictSchemaParsing: snapshot.strictSchemaParsing,
    preserveRawSms: snapshot.preserveRawSms,
    autoReconciliation: snapshot.autoReconciliation,
    verboseLogging: snapshot.verboseLogging,
  };
}

function toAuthorityState(
  snapshot: ParserWorkspacePreferenceSnapshot,
): ParserWorkspaceAuthorityState {
  return {
    version: 1,
    templateWorkspace: snapshot.templateWorkspace,
    selectedTemplateId: snapshot.selectedTemplateId,
    senderLabel: snapshot.senderLabel,
    strictSchemaParsing: snapshot.strictSchemaParsing,
    preserveRawSms: snapshot.preserveRawSms,
    autoReconciliation: snapshot.autoReconciliation,
    verboseLogging: snapshot.verboseLogging,
  };
}

function readAuthorityBackedParserWorkspace():
  | ParserWorkspacePreferenceSnapshot
  | null {
  const authorityState = transactionStore.getState().parserWorkspaceAuthorityState;
  if (!authorityState) {
    return null;
  }

  return buildNormalizedPreferenceSnapshot(authorityState);
}

function clearLegacyParserWorkspaceStorage() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(PARSER_WORKSPACE_STORAGE_KEY);
  } catch {}
}

function readLegacyParserWorkspacePreferences():
  | ParserWorkspacePreferenceSnapshot
  | null {
  if (!canUseStorage()) {
    return null;
  }

  let rawValue: string | null = null;

  try {
    rawValue = window.localStorage.getItem(PARSER_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isWorkspaceSnapshot(parsed)) {
      return null;
    }

    return normalizeWorkspaceSnapshot(parsed);
  } catch {
    return null;
  }
}

function isParserWorkspacePreferenceSnapshot(
  snapshot: ParserWorkspacePreferenceSnapshot | null,
): snapshot is ParserWorkspacePreferenceSnapshot {
  return snapshot?.version === 3;
}

export function resolveParserWorkspaceTemplateIds(
  snapshot: ParserWorkspacePreferenceSnapshot | null,
): string[] {
  if (!isParserWorkspacePreferenceSnapshot(snapshot)) {
    return [];
  }

  return resolveParserTemplateWorkspace(snapshot.templateWorkspace).map(
    (template) => template.id,
  );
}

export function createDefaultParserWorkspacePreferenceSnapshot(): ParserWorkspacePreferenceSnapshot {
  const templateWorkspace = createDefaultParserTemplateWorkspace();
  const resolvedTemplates = resolveParserTemplateWorkspace(templateWorkspace);

  return {
    version: 3,
    templateWorkspace,
    selectedTemplateId: resolvedTemplates[0]?.id ?? "",
    senderLabel:
      resolvedTemplates[0]?.senderAliases[0] ??
      resolvedTemplates[0]?.institutionKey ??
      "CBE",
    strictSchemaParsing: true,
    preserveRawSms: true,
    autoReconciliation: true,
    verboseLogging: false,
  };
}

export function readParserWorkspacePreferences():
  | ParserWorkspacePreferenceSnapshot
  | null {
  const authorityBackedSnapshot = readAuthorityBackedParserWorkspace();
  if (authorityBackedSnapshot) {
    clearLegacyParserWorkspaceStorage();
    return authorityBackedSnapshot;
  }

  const legacySnapshot = readLegacyParserWorkspacePreferences();
  if (!legacySnapshot) {
    return null;
  }

  transactionStore
    .getState()
    .setParserWorkspaceAuthorityState(toAuthorityState(legacySnapshot));
  clearLegacyParserWorkspaceStorage();
  return legacySnapshot;
}

export function persistParserWorkspacePreferences(
  snapshot: ParserWorkspacePreferenceSnapshot,
) {
  transactionStore
    .getState()
    .setParserWorkspaceAuthorityState(toAuthorityState(snapshot));
  clearLegacyParserWorkspaceStorage();
}

export function clearParserWorkspacePreferences() {
  transactionStore.getState().clearParserWorkspaceAuthorityState();
  clearLegacyParserWorkspaceStorage();
}
