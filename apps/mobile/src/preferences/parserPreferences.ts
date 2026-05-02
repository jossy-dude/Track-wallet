const PARSER_WORKSPACE_STORAGE_KEY = "trackwallet.mobile.parser-workspace";

export type ParserTemplatePreferenceStatus =
  | "active"
  | "draft"
  | "fallback"
  | "disabled";

export interface ParserTemplatePreference {
  id: string;
  institutionKey: string;
  institutionLabel: string;
  institutionIcon: string;
  name: string;
  version: string;
  updated: string;
  status: ParserTemplatePreferenceStatus;
  regex: string;
  note: string;
  healthScore: number | null;
  sourceType: "core" | "local";
}

export interface ParserWorkspacePreferenceSnapshot {
  version: 1;
  templates: ParserTemplatePreference[];
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

function isTemplateStatus(
  value: unknown,
): value is ParserTemplatePreferenceStatus {
  return (
    value === "active" ||
    value === "draft" ||
    value === "fallback" ||
    value === "disabled"
  );
}

function isTemplatePreference(
  value: unknown,
): value is ParserTemplatePreference {
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

function isWorkspaceSnapshot(
  value: unknown,
): value is ParserWorkspacePreferenceSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    Array.isArray(value.templates) &&
    value.templates.every(isTemplatePreference) &&
    typeof value.selectedTemplateId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.strictSchemaParsing === "boolean" &&
    typeof value.preserveRawSms === "boolean" &&
    typeof value.autoReconciliation === "boolean" &&
    typeof value.verboseLogging === "boolean"
  );
}

export function readParserWorkspacePreferences():
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
    return isWorkspaceSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistParserWorkspacePreferences(
  snapshot: ParserWorkspacePreferenceSnapshot,
) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      PARSER_WORKSPACE_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {}
}

export function clearParserWorkspacePreferences() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(PARSER_WORKSPACE_STORAGE_KEY);
  } catch {}
}
