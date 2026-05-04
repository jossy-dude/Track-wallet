export interface AccountProfilePreferences {
  displayName: string;
  profileNote: string;
  hideBalances: boolean;
  blurNotifications: boolean;
  requireExportReview: boolean;
}

const ACCOUNT_PROFILE_STORAGE_KEY = "trackwallet.mobile.account-profile";
const ACCOUNT_PROFILE_EVENT = "trackwallet:account-profile";

const defaultAccountProfilePreferences: AccountProfilePreferences = {
  displayName: "Device owner",
  profileNote: "Local approver for this mobile workspace",
  hideBalances: true,
  blurNotifications: true,
  requireExportReview: true,
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function dispatchPreferenceEvent(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readAccountProfilePreferences(): AccountProfilePreferences {
  if (!canUseStorage()) {
    return { ...defaultAccountProfilePreferences };
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_PROFILE_STORAGE_KEY);

    if (!raw) {
      return { ...defaultAccountProfilePreferences };
    }

    const parsed = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return { ...defaultAccountProfilePreferences };
    }

    return {
      displayName:
        typeof parsed.displayName === "string" &&
        parsed.displayName.trim().length > 0
          ? parsed.displayName
          : defaultAccountProfilePreferences.displayName,
      profileNote:
        typeof parsed.profileNote === "string"
          ? parsed.profileNote
          : defaultAccountProfilePreferences.profileNote,
      hideBalances:
        typeof parsed.hideBalances === "boolean"
          ? parsed.hideBalances
          : defaultAccountProfilePreferences.hideBalances,
      blurNotifications:
        typeof parsed.blurNotifications === "boolean"
          ? parsed.blurNotifications
          : defaultAccountProfilePreferences.blurNotifications,
      requireExportReview:
        typeof parsed.requireExportReview === "boolean"
          ? parsed.requireExportReview
          : defaultAccountProfilePreferences.requireExportReview,
    };
  } catch {
    return { ...defaultAccountProfilePreferences };
  }
}

export function persistAccountProfilePreferences(
  preferences: AccountProfilePreferences,
) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    ACCOUNT_PROFILE_STORAGE_KEY,
    JSON.stringify(preferences),
  );
  dispatchPreferenceEvent(ACCOUNT_PROFILE_EVENT);
}

export function clearAccountProfilePreferences() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCOUNT_PROFILE_STORAGE_KEY);
  dispatchPreferenceEvent(ACCOUNT_PROFILE_EVENT);
}

export function getAccountProfilePreferencesStorageKey() {
  return ACCOUNT_PROFILE_STORAGE_KEY;
}

export function getAccountProfilePreferencesEvent() {
  return ACCOUNT_PROFILE_EVENT;
}

export function getDefaultAccountProfilePreferences() {
  return { ...defaultAccountProfilePreferences };
}
