export type HomeBalanceDetailMode = "simple" | "detailed";
export type CurrencyLabelPreference = "ETB" | "Br" | "Birr";
export type BottomNavStylePreference = "detached" | "connected";

const HOME_BALANCE_DETAIL_STORAGE_KEY =
  "trackwallet.mobile.home-balance-detail-mode";
const HOME_BALANCE_DETAIL_EVENT = "trackwallet:home-balance-detail-mode";
const DEFAULT_ACCOUNT_STORAGE_KEY = "trackwallet.mobile.default-account-id";
const DEFAULT_ACCOUNT_EVENT = "trackwallet:default-account-id";
const ACCOUNT_ORDER_STORAGE_KEY = "trackwallet.mobile.account-order";
const ACCOUNT_ORDER_EVENT = "trackwallet:account-order";
const CURRENCY_LABEL_STORAGE_KEY = "trackwallet.mobile.currency-label";
const CURRENCY_LABEL_EVENT = "trackwallet:currency-label";
const BOTTOM_NAV_STYLE_STORAGE_KEY = "trackwallet.mobile.bottom-nav-style";
const BOTTOM_NAV_STYLE_EVENT = "trackwallet:bottom-nav-style";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function dispatchPreferenceEvent(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

export function readHomeBalanceDetailMode(): HomeBalanceDetailMode {
  if (!canUseStorage()) {
    return "detailed";
  }

  return window.localStorage.getItem(HOME_BALANCE_DETAIL_STORAGE_KEY) === "simple"
    ? "simple"
    : "detailed";
}

export function persistHomeBalanceDetailMode(mode: HomeBalanceDetailMode) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(HOME_BALANCE_DETAIL_STORAGE_KEY, mode);
  dispatchPreferenceEvent(HOME_BALANCE_DETAIL_EVENT);
}

export function readDefaultAccountIdPreference(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(DEFAULT_ACCOUNT_STORAGE_KEY);
}

export function persistDefaultAccountIdPreference(accountId: string | null) {
  if (!canUseStorage()) {
    return;
  }

  if (accountId) {
    window.localStorage.setItem(DEFAULT_ACCOUNT_STORAGE_KEY, accountId);
  } else {
    window.localStorage.removeItem(DEFAULT_ACCOUNT_STORAGE_KEY);
  }

  dispatchPreferenceEvent(DEFAULT_ACCOUNT_EVENT);
}

export function readAccountOrderPreference(): string[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNT_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function persistAccountOrderPreference(accountIds: readonly string[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    ACCOUNT_ORDER_STORAGE_KEY,
    JSON.stringify(accountIds),
  );
  dispatchPreferenceEvent(ACCOUNT_ORDER_EVENT);
}

export function readCurrencyLabelPreference(): CurrencyLabelPreference {
  if (!canUseStorage()) {
    return "ETB";
  }

  const persisted = window.localStorage.getItem(CURRENCY_LABEL_STORAGE_KEY);

  if (persisted === "Br" || persisted === "Birr") {
    return persisted;
  }

  return "ETB";
}

export function persistCurrencyLabelPreference(label: CurrencyLabelPreference) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(CURRENCY_LABEL_STORAGE_KEY, label);
  dispatchPreferenceEvent(CURRENCY_LABEL_EVENT);
}

export function readBottomNavStylePreference(): BottomNavStylePreference {
  if (!canUseStorage()) {
    return "detached";
  }

  return window.localStorage.getItem(BOTTOM_NAV_STYLE_STORAGE_KEY) === "connected"
    ? "connected"
    : "detached";
}

export function persistBottomNavStylePreference(
  style: BottomNavStylePreference,
) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BOTTOM_NAV_STYLE_STORAGE_KEY, style);
  dispatchPreferenceEvent(BOTTOM_NAV_STYLE_EVENT);
}

export function getHomeBalanceDetailPreferenceKey() {
  return HOME_BALANCE_DETAIL_STORAGE_KEY;
}

export function getHomeBalanceDetailPreferenceEvent() {
  return HOME_BALANCE_DETAIL_EVENT;
}

export function getDefaultAccountPreferenceKey() {
  return DEFAULT_ACCOUNT_STORAGE_KEY;
}

export function getDefaultAccountPreferenceEvent() {
  return DEFAULT_ACCOUNT_EVENT;
}

export function getCurrencyLabelPreferenceKey() {
  return CURRENCY_LABEL_STORAGE_KEY;
}

export function getCurrencyLabelPreferenceEvent() {
  return CURRENCY_LABEL_EVENT;
}

export function getBottomNavStylePreferenceKey() {
  return BOTTOM_NAV_STYLE_STORAGE_KEY;
}

export function getBottomNavStylePreferenceEvent() {
  return BOTTOM_NAV_STYLE_EVENT;
}

export function getAccountOrderPreferenceKey() {
  return ACCOUNT_ORDER_STORAGE_KEY;
}

export function getAccountOrderPreferenceEvent() {
  return ACCOUNT_ORDER_EVENT;
}

export function clearFinanceLinkedDisplayPreferences() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(DEFAULT_ACCOUNT_STORAGE_KEY);
  window.localStorage.removeItem(ACCOUNT_ORDER_STORAGE_KEY);
  dispatchPreferenceEvent(DEFAULT_ACCOUNT_EVENT);
  dispatchPreferenceEvent(ACCOUNT_ORDER_EVENT);
}
