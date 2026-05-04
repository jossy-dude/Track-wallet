const ONBOARDING_COMPLETED_STORAGE_KEY =
  "trackwallet.mobile.onboarding-complete-v2";
const DEMO_MODE_STORAGE_KEY = "trackwallet.mobile.demo-mode-v1";
const SETUP_CHECKLIST_PENDING_STORAGE_KEY =
  "trackwallet.mobile.setup-checklist-pending-v1";
const SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY =
  "trackwallet.mobile.showcase-location-reviewed-v1";
const DEMO_MODE_EVENT = "trackwallet:demo-mode";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function dispatchPreferenceEvent(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

export function readOnboardingCompleted() {
  if (!canUseStorage()) {
    return true;
  }

  return window.localStorage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY) === "yes";
}

export function persistOnboardingCompleted() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, "yes");
}

export function readDemoModeEnabled() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

export function persistDemoModeEnabled(isEnabled: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, isEnabled ? "true" : "false");
  dispatchPreferenceEvent(DEMO_MODE_EVENT);
}

export function getDemoModePreferenceEvent() {
  return DEMO_MODE_EVENT;
}

export function getDemoModePreferenceKey() {
  return DEMO_MODE_STORAGE_KEY;
}

export function getOnboardingCompletedPreferenceKey() {
  return ONBOARDING_COMPLETED_STORAGE_KEY;
}

export function readSetupChecklistPending() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(SETUP_CHECKLIST_PENDING_STORAGE_KEY) === "yes";
}

export function persistSetupChecklistPending(isPending: boolean) {
  if (!canUseStorage()) {
    return;
  }

  if (isPending) {
    window.localStorage.setItem(SETUP_CHECKLIST_PENDING_STORAGE_KEY, "yes");
  } else {
    window.localStorage.removeItem(SETUP_CHECKLIST_PENDING_STORAGE_KEY);
  }
}

export function readShowcaseLocationReviewed() {
  if (!canUseStorage()) {
    return false;
  }

  return (
    window.localStorage.getItem(SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY) === "yes"
  );
}

export function persistShowcaseLocationReviewed(isReviewed: boolean) {
  if (!canUseStorage()) {
    return;
  }

  if (isReviewed) {
    window.localStorage.setItem(SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY, "yes");
  } else {
    window.localStorage.removeItem(SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY);
  }
}

export function clearSetupChecklistProgress() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SETUP_CHECKLIST_PENDING_STORAGE_KEY);
  window.localStorage.removeItem(SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY);
}

export function getSetupChecklistPendingPreferenceKey() {
  return SETUP_CHECKLIST_PENDING_STORAGE_KEY;
}

export function getShowcaseLocationReviewedPreferenceKey() {
  return SHOWCASE_LOCATION_REVIEWED_STORAGE_KEY;
}
