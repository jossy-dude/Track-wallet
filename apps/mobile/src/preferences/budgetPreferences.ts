const BUDGET_WORKSPACE_STORAGE_KEY = "trackwallet.mobile.budget-workspace-v1";

export interface BudgetWorkspacePreferenceSnapshot {
  version: 1;
  visibleBudgetIds: string[];
  limitOverrides: Record<string, number>;
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

export function readBudgetWorkspacePreferences():
  | BudgetWorkspacePreferenceSnapshot
  | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BUDGET_WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    const visibleBudgetIds = Array.isArray(parsed.visibleBudgetIds)
      ? parsed.visibleBudgetIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const limitOverrides = isRecord(parsed.limitOverrides)
      ? Object.fromEntries(
          Object.entries(parsed.limitOverrides).filter(
            (entry): entry is [string, number] =>
              typeof entry[0] === "string" &&
              typeof entry[1] === "number" &&
              Number.isFinite(entry[1]) &&
              entry[1] > 0,
          ),
        )
      : {};

    return {
      version: 1,
      visibleBudgetIds,
      limitOverrides,
    };
  } catch {
    return null;
  }
}

export function persistBudgetWorkspacePreferences(input: {
  visibleBudgetIds: readonly string[];
  limitOverrides: Record<string, number>;
}) {
  if (!canUseStorage()) {
    return;
  }

  const snapshot: BudgetWorkspacePreferenceSnapshot = {
    version: 1,
    visibleBudgetIds: [...input.visibleBudgetIds],
    limitOverrides: { ...input.limitOverrides },
  };

  window.localStorage.setItem(
    BUDGET_WORKSPACE_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

export function clearBudgetWorkspacePreferences() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(BUDGET_WORKSPACE_STORAGE_KEY);
}

export function getBudgetWorkspacePreferenceKey() {
  return BUDGET_WORKSPACE_STORAGE_KEY;
}
