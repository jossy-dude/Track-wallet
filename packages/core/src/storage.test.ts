import { describe, expect, it } from "vitest";

import type { HistoricalImportPackage } from "./storage";
import {
  sanitizeHistoricalImportDefaults,
  summarizeHistoricalImportPackage,
} from "./storage";
import type {
  ParsedTransactionDraft,
  ParserTemplateDefinition,
  UnmatchedSmsEntry,
} from "./types";

function createDraft(
  overrides: Partial<ParsedTransactionDraft> = {},
): ParsedTransactionDraft {
  return {
    draftId: "draft-001",
    rawMessageId: "raw-001",
    senderLabel: "CBE",
    rawBody: "Imported historical row",
    financialInstitution: "cbe",
    transactionDirection: "debit",
    amountMinor: 12500,
    feeMinor: 0,
    runningBalanceMinor: 985700,
    reportedBalanceMinor: 985700,
    currencyCode: "ETB",
    title: "Imported Grocery",
    merchantName: "Imported Grocery",
    category: "food",
    parserTemplateId: "cbe_runtime_v1",
    confidence: 100,
    occurredAt: "2026-04-20T08:00:00.000Z",
    accountReference: "4920",
    reference: "ref-001",
    accountChannel: "bank",
    note: "",
    ...overrides,
  };
}

function createTemplate(
  overrides: Partial<ParserTemplateDefinition> = {},
): ParserTemplateDefinition {
  return {
    id: "cbe_runtime_v1",
    financialInstitution: "cbe",
    institutionKey: "CBE",
    institutionLabel: "Commercial Bank of Ethiopia",
    institutionIcon: "account_balance",
    senderAliases: ["CBE"],
    accountIdentifiers: [],
    identityTextFragments: [],
    name: "CBE Runtime Template",
    version: "v1.0.0",
    updated: "Runtime template",
    status: "active",
    regex: "CBE ALERT",
    note: "Runtime template",
    healthScore: 100,
    sourceType: "core",
    templateKind: "builtin",
    engineEditable: false,
    userProfile: {
      senderAliases: ["CBE"],
      accountIdentifiers: [],
      identityTextFragments: [],
    },
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    accountKey: "account",
    dateKey: "date",
    dateMode: "message_date",
    ...overrides,
  };
}

function createUnmatchedEntry(
  overrides: Partial<UnmatchedSmsEntry> = {},
): UnmatchedSmsEntry {
  return {
    unmatchedEntryId: "unmatched-001",
    rawMessageId: "raw-unmatched-001",
    senderLabel: "Unknown Sender",
    smsBody: "Lunch tomorrow at 1pm?",
    receivedAt: "2026-05-01T09:00:00.000Z",
    capturedAt: "2026-05-01T09:00:05.000Z",
    failureReason: "no_template_match",
    ...overrides,
  };
}

describe("storage contracts", () => {
  it("summarizes parser template coverage for a staged historical import package", () => {
    const historicalImportPackage: HistoricalImportPackage = {
      kind: "trackwallet-historical-import",
      version: 1,
      createdAt: "2026-05-02T10:00:00.000Z",
      drafts: [
        createDraft({
          draftId: "draft-active-001",
          rawMessageId: "raw-active-001",
          parserTemplateId: "cbe_runtime_v1",
        }),
        createDraft({
          draftId: "draft-disabled-001",
          rawMessageId: "raw-disabled-001",
          parserTemplateId: "cbe_disabled_v1",
          amountMinor: 9000,
          accountReference: "7001",
        }),
        createDraft({
          draftId: "draft-missing-001",
          rawMessageId: "raw-missing-001",
          parserTemplateId: "local_missing_v1",
          amountMinor: 6400,
          reportedBalanceMinor: undefined,
          accountReference: "wallet-01",
          accountChannel: "mobile_money",
        }),
      ],
      unmatchedEntries: [createUnmatchedEntry()],
    };

    const summary = summarizeHistoricalImportPackage(historicalImportPackage, [
      createTemplate(),
      createTemplate({
        id: "cbe_disabled_v1",
        status: "disabled",
        name: "Disabled CBE Runtime Template",
      }),
      createTemplate({
        id: "cbe_draft_v1",
        status: "draft",
        name: "Draft CBE Runtime Template",
      }),
    ]);

    expect(summary.draftCount).toBe(3);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.reportedBalanceDraftCount).toBe(2);
    expect(summary.uniqueAccountCount).toBe(3);
    expect(summary.unknownTemplateIds).toEqual(["local_missing_v1"]);
    expect(summary.disabledTemplateIds).toEqual(["cbe_disabled_v1"]);
    expect(summary.draftTemplateIds).toEqual([]);
    expect(summary.templateUsage).toEqual([
      expect.objectContaining({
        templateId: "cbe_disabled_v1",
        templateStatus: "disabled",
        draftCount: 1,
      }),
      expect.objectContaining({
        templateId: "cbe_runtime_v1",
        templateStatus: "active",
        draftCount: 1,
      }),
      expect.objectContaining({
        templateId: "local_missing_v1",
        templateStatus: "unknown",
        draftCount: 1,
      }),
    ]);
  });

  it("sanitizes backup defaults without collapsing duplicate review mode", () => {
    expect(
      sanitizeHistoricalImportDefaults({
        importMode: "replace",
        duplicateMode: "review",
        reviewWindowDays: 45,
      }),
    ).toEqual({
      importMode: "replace",
      duplicateMode: "review",
      reviewWindowDays: 45,
    });

    expect(
      sanitizeHistoricalImportDefaults({
        importMode: "not-real",
        duplicateMode: "also-not-real",
        reviewWindowDays: -5,
      }),
    ).toEqual({
      importMode: "backup_then_replace",
      duplicateMode: "skip",
      reviewWindowDays: 0,
    });
  });
});
