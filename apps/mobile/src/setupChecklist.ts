import type { SmsCaptureRoutingSummary } from "@omni-sync/core";

export interface PrivateWalletSetupState {
  accountReady: boolean;
  captureReady: boolean;
  captureRequired: boolean;
  allReady: boolean;
}

export function isSmsCaptureSetupRequired(
  summary: Pick<
    SmsCaptureRoutingSummary,
    "buildMode" | "nativeCaptureAvailable" | "captureSupported"
  >,
): boolean {
  return (
    summary.buildMode === "native_capture" &&
    summary.nativeCaptureAvailable &&
    summary.captureSupported
  );
}

export function isSmsCaptureSetupReady(
  summary: Pick<
    SmsCaptureRoutingSummary,
    | "buildMode"
    | "nativeCaptureAvailable"
    | "captureSupported"
    | "hasSenderRules"
    | "runtimeStatus"
  >,
): boolean {
  if (!isSmsCaptureSetupRequired(summary)) {
    return true;
  }

  return summary.hasSenderRules && summary.runtimeStatus === "capturing";
}

export function getPrivateWalletSetupState({
  hasAccount,
  routingSummary,
}: {
  hasAccount: boolean;
  routingSummary: Pick<
    SmsCaptureRoutingSummary,
    | "buildMode"
    | "nativeCaptureAvailable"
    | "captureSupported"
    | "hasSenderRules"
    | "runtimeStatus"
  >;
}): PrivateWalletSetupState {
  const captureRequired = isSmsCaptureSetupRequired(routingSummary);
  const captureReady = isSmsCaptureSetupReady(routingSummary);

  return {
    accountReady: hasAccount,
    captureReady,
    captureRequired,
    allReady: hasAccount && captureReady,
  };
}

export function getPrivateWalletSetupContinueLabel(
  state: PrivateWalletSetupState,
): string {
  if (!state.accountReady) {
    return "Go to account setup";
  }

  if (state.captureRequired && !state.captureReady) {
    return "Open SMS capture";
  }

  return "Open wallet";
}
