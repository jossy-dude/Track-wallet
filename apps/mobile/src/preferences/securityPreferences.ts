import {
  DEFAULT_SECURITY_PREFERENCES,
  type SecurityPreferences,
} from "@omni-sync/core";
import { transactionStore } from "@omni-sync/database";

const SECURITY_PREFERENCES_STORAGE_KEY =
  "trackwallet.mobile.security-preferences";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneSecurityPreferences(
  preferences: SecurityPreferences,
): SecurityPreferences {
  return { ...preferences };
}

function sanitizeSecurityPreferences(
  value: Record<string, unknown>,
): SecurityPreferences {
  return {
    biometricsEnabled:
      typeof value.biometricsEnabled === "boolean"
        ? value.biometricsEnabled
        : DEFAULT_SECURITY_PREFERENCES.biometricsEnabled,
    requireBiometricOnOpen:
      typeof value.requireBiometricOnOpen === "boolean"
        ? value.requireBiometricOnOpen
        : DEFAULT_SECURITY_PREFERENCES.requireBiometricOnOpen,
    requireBiometricOnApprove:
      typeof value.requireBiometricOnApprove === "boolean"
        ? value.requireBiometricOnApprove
        : DEFAULT_SECURITY_PREFERENCES.requireBiometricOnApprove,
    requireBiometricOnDelete:
      typeof value.requireBiometricOnDelete === "boolean"
        ? value.requireBiometricOnDelete
        : DEFAULT_SECURITY_PREFERENCES.requireBiometricOnDelete,
    requireBiometricOnForwarding:
      typeof value.requireBiometricOnForwarding === "boolean"
        ? value.requireBiometricOnForwarding
        : DEFAULT_SECURITY_PREFERENCES.requireBiometricOnForwarding,
    twoFactorEnabled:
      typeof value.twoFactorEnabled === "boolean"
        ? value.twoFactorEnabled
        : DEFAULT_SECURITY_PREFERENCES.twoFactorEnabled,
  };
}

function clearLegacySecurityPreferencesStorage() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(SECURITY_PREFERENCES_STORAGE_KEY);
  } catch {}
}

function readAuthorityBackedSecurityPreferences(): SecurityPreferences | null {
  const securityPreferences = transactionStore.getState().securityPreferences;

  return securityPreferences == null
    ? null
    : cloneSecurityPreferences(securityPreferences);
}

function readLegacySecurityPreferences(): SecurityPreferences | null {
  if (!canUseStorage()) {
    return null;
  }

  let rawValue: string | null = null;

  try {
    rawValue = window.localStorage.getItem(SECURITY_PREFERENCES_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!isRecord(parsed)) {
      clearLegacySecurityPreferencesStorage();
      return null;
    }

    return sanitizeSecurityPreferences(parsed);
  } catch {
    clearLegacySecurityPreferencesStorage();
    return null;
  }
}

export function readSecurityPreferences(): SecurityPreferences {
  const authorityBackedPreferences = readAuthorityBackedSecurityPreferences();

  if (authorityBackedPreferences) {
    clearLegacySecurityPreferencesStorage();
    return authorityBackedPreferences;
  }

  const legacyPreferences = readLegacySecurityPreferences();

  if (legacyPreferences) {
    transactionStore.getState().setSecurityPreferences(legacyPreferences);
    clearLegacySecurityPreferencesStorage();
    return legacyPreferences;
  }

  return cloneSecurityPreferences(DEFAULT_SECURITY_PREFERENCES);
}

export function persistSecurityPreferences(
  preferences: SecurityPreferences,
) {
  transactionStore
    .getState()
    .setSecurityPreferences(cloneSecurityPreferences(preferences));
  clearLegacySecurityPreferencesStorage();
}

export function getDefaultSecurityPreferences() {
  return cloneSecurityPreferences(DEFAULT_SECURITY_PREFERENCES);
}
