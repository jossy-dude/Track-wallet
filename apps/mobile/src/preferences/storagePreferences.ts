import type {
  HistoricalImportDuplicateMode,
  HistoricalImportMode,
} from "@omni-sync/core";

const IMPORT_MODE_STORAGE_KEY = "trackwallet.mobile.import-mode";
const DUPLICATE_MODE_STORAGE_KEY = "trackwallet.mobile.import-duplicate-mode";
const REVIEW_DAYS_STORAGE_KEY = "trackwallet.mobile.import-review-days";

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

export function readImportModePreference(): HistoricalImportMode {
  if (!canUseStorage()) {
    return "backup_then_replace";
  }

  const value = window.localStorage.getItem(IMPORT_MODE_STORAGE_KEY);

  if (
    value === "merge" ||
    value === "replace" ||
    value === "backup_then_replace"
  ) {
    return value;
  }

  return "backup_then_replace";
}

export function persistImportModePreference(mode: HistoricalImportMode) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(IMPORT_MODE_STORAGE_KEY, mode);
  } catch {}
}

export function readImportDuplicateModePreference(): HistoricalImportDuplicateMode {
  if (!canUseStorage()) {
    return "skip";
  }

  let value: string | null = null;

  try {
    value = window.localStorage.getItem(DUPLICATE_MODE_STORAGE_KEY);
  } catch {
    return "skip";
  }

  return value === "review" ? "review" : "skip";
}

export function persistImportDuplicateModePreference(
  duplicateMode: HistoricalImportDuplicateMode,
) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(DUPLICATE_MODE_STORAGE_KEY, duplicateMode);
  } catch {}
}

export function readImportReviewDaysPreference(): number {
  if (!canUseStorage()) {
    return 20;
  }

  let rawValue = Number.NaN;

  try {
    rawValue = Number(window.localStorage.getItem(REVIEW_DAYS_STORAGE_KEY));
  } catch {
    return 20;
  }

  if (!Number.isFinite(rawValue)) {
    return 20;
  }

  return Math.max(0, Math.round(rawValue));
}

export function persistImportReviewDaysPreference(reviewDays: number) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      REVIEW_DAYS_STORAGE_KEY,
      String(Math.max(0, Math.round(reviewDays))),
    );
  } catch {}
}
