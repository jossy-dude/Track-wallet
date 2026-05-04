import { describe, expect, it } from "vitest";

import type { SmsCaptureRoutingSummary } from "@omni-sync/core";

import {
  getPrivateWalletSetupContinueLabel,
  getPrivateWalletSetupState,
  isSmsCaptureSetupReady,
} from "./setupChecklist";

function buildRoutingSummary(
  overrides: Partial<SmsCaptureRoutingSummary> = {},
): SmsCaptureRoutingSummary {
  return {
    runtimeStatus: "manual_only",
    captureEnabled: false,
    buildMode: "manual_only",
    permissionState: "unknown",
    nativeCaptureAvailable: false,
    captureSupported: false,
    historyCaptureSupported: false,
    exactSenderRuleCount: 0,
    enabledSenderRuleCount: 0,
    disabledSenderRuleCount: 0,
    hasSenderRules: false,
    queueItemCount: 0,
    pendingCount: 0,
    parsingCount: 0,
    parsedCount: 0,
    unmatchedCount: 0,
    failedCount: 0,
    oldestPendingCaptureId: null,
    oldestPendingCapturedAt: null,
    lastCapturedAt: null,
    lastCapturedSenderLabel: null,
    lastParsedAt: null,
    lastUnmatchedAt: null,
    lastFailedAt: null,
    lastFailedReason: null,
    lastParserHandoffAt: null,
    duplicateSuppressedCount: 0,
    filteredOutCount: 0,
    backfillCapability: "unsupported",
    backfillRequestedLookbackDays: null,
    backfillRequestStatus: "idle",
    backfillRequestedAt: null,
    ...overrides,
  };
}

describe("isSmsCaptureSetupReady", () => {
  it("treats manual-only builds as not requiring live capture to unblock setup", () => {
    expect(
      isSmsCaptureSetupReady(
        buildRoutingSummary({
          buildMode: "manual_only",
          runtimeStatus: "manual_only",
          nativeCaptureAvailable: false,
          captureSupported: false,
          hasSenderRules: false,
        }),
      ),
    ).toBe(true);
  });

  it("does not treat parser residue or sender rules alone as live capture readiness", () => {
    expect(
      isSmsCaptureSetupReady(
        buildRoutingSummary({
          enabledSenderRuleCount: 1,
          exactSenderRuleCount: 1,
          hasSenderRules: true,
          runtimeStatus: "native_available",
          captureEnabled: false,
          buildMode: "native_capture",
          nativeCaptureAvailable: true,
          captureSupported: true,
        }),
      ),
    ).toBe(false);
  });

  it("marks setup ready only when live capture is armed with sender rules", () => {
    expect(
      isSmsCaptureSetupReady(
        buildRoutingSummary({
          enabledSenderRuleCount: 1,
          exactSenderRuleCount: 1,
          hasSenderRules: true,
          runtimeStatus: "capturing",
          captureEnabled: true,
          buildMode: "native_capture",
          nativeCaptureAvailable: true,
          captureSupported: true,
          permissionState: "granted",
        }),
      ),
    ).toBe(true);
  });
});

describe("getPrivateWalletSetupState", () => {
  it("tracks private-wallet readiness from only account setup and live sms capture", () => {
    expect(
      getPrivateWalletSetupState({
        hasAccount: false,
        routingSummary: buildRoutingSummary(),
      }),
    ).toEqual({
      accountReady: false,
      captureReady: true,
      captureRequired: false,
      allReady: false,
    });

    expect(
      getPrivateWalletSetupState({
        hasAccount: true,
        routingSummary: buildRoutingSummary(),
      }),
    ).toEqual({
        accountReady: true,
        captureReady: true,
        captureRequired: false,
        allReady: true,
      });

    expect(
      getPrivateWalletSetupState({
        hasAccount: true,
        routingSummary: buildRoutingSummary({
          enabledSenderRuleCount: 1,
          exactSenderRuleCount: 1,
          hasSenderRules: true,
          runtimeStatus: "capturing",
          captureEnabled: true,
          buildMode: "native_capture",
          nativeCaptureAvailable: true,
          captureSupported: true,
          permissionState: "granted",
        }),
      }),
    ).toEqual({
      accountReady: true,
      captureReady: true,
      captureRequired: true,
      allReady: true,
    });
  });

  it("marks native-capable builds as still needing sms setup when live capture is available but not armed", () => {
    expect(
      getPrivateWalletSetupState({
        hasAccount: true,
        routingSummary: buildRoutingSummary({
          buildMode: "native_capture",
          runtimeStatus: "native_available",
          captureEnabled: false,
          nativeCaptureAvailable: true,
          captureSupported: true,
          permissionState: "granted",
          hasSenderRules: false,
        }),
      }),
    ).toEqual({
      accountReady: true,
      captureReady: false,
      captureRequired: true,
      allReady: false,
    });
  });
});

describe("getPrivateWalletSetupContinueLabel", () => {
  it("uses step-aware labels for the next setup action", () => {
    expect(
      getPrivateWalletSetupContinueLabel({
        accountReady: false,
        captureReady: true,
        captureRequired: false,
        allReady: false,
      }),
    ).toBe("Go to account setup");

    expect(
      getPrivateWalletSetupContinueLabel({
        accountReady: true,
        captureReady: false,
        captureRequired: true,
        allReady: false,
      }),
    ).toBe("Open SMS capture");

    expect(
      getPrivateWalletSetupContinueLabel({
        accountReady: true,
        captureReady: true,
        captureRequired: false,
        allReady: true,
      }),
    ).toBe("Open wallet");
  });
});
