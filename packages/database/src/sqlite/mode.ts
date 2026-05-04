import type { AuthorityMode } from "@omni-sync/core";

export interface SQLiteModeSelectionInput {
  mode?: AuthorityMode | null;
  preferDemo?: boolean;
  allowReal?: boolean;
}

export function normalizeSQLiteMode(
  mode: AuthorityMode | string | null | undefined,
  fallback: AuthorityMode = "demo",
): AuthorityMode {
  if (mode === "real" || mode === "demo") {
    return mode;
  }

  return fallback;
}

export function selectSQLiteMode(
  input: SQLiteModeSelectionInput = {},
): AuthorityMode {
  const normalizedMode = normalizeSQLiteMode(input.mode);

  if (normalizedMode === "real" && input.allowReal !== false) {
    return "real";
  }

  if (normalizedMode === "demo") {
    return "demo";
  }

  return input.preferDemo === false && input.allowReal !== false
    ? "real"
    : "demo";
}

export function isDemoSQLiteMode(mode: AuthorityMode | string | null | undefined) {
  return normalizeSQLiteMode(mode) === "demo";
}
