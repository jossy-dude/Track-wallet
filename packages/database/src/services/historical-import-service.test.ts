import { describe, expect, it } from "vitest";

import type {
  AccountSummary,
  ApprovedTransaction,
  ParsedTransactionDraft,
  UnmatchedSmsEntry,
} from "@omni-sync/core";

import {
  buildHistoricalImportAccountKey,
  importHistoricalTransactions,
} from "./historical-import-service";

function createDraft(
  overrides: Partial<ParsedTransactionDraft> = {},
): ParsedTransactionDraft {
  return {
    draftId: "draft-001",
    rawMessageId: "raw-001",
    senderLabel: "CBE",
    rawBody: "CBE ALERT",
    financialInstitution: "cbe",
    transactionDirection: "debit",
    amountMinor: 12500,
    feeMinor: 300,
    runningBalanceMinor: 985700,
    reportedBalanceMinor: 985700,
    currencyCode: "ETB",
    title: "Neighborhood Grocery",
    merchantName: "Neighborhood Grocery",
    category: "food",
    parserTemplateId: "cbe_v1",
    confidence: 100,
    occurredAt: "2026-03-01T08:00:00.000Z",
    accountReference: "4920",
    reference: "ref-001",
    accountChannel: "bank",
    note: "",
    ...overrides,
  };
}

function createApprovedTransaction(
  overrides: Partial<ApprovedTransaction> = {},
): ApprovedTransaction {
  const draft = createDraft();

  return {
    ...draft,
    transactionId: "txn-001",
    approvedAt: "2026-03-01T08:05:00.000Z",
    approvalStatus: "approved",
    note: "",
    ...overrides,
  };
}

function createAccountSummary(
  overrides: Partial<AccountSummary> = {},
): AccountSummary {
  return {
    accountId: "acct-cbe-4920",
    institutionName: "CBE",
    maskedAccountNumber: "**** 4920",
    fullAccountNumber: "4920",
    balanceMinor: 985700,
    currencyCode: "ETB",
    channel: "bank",
    iconName: "account_balance",
    tone: "primary",
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

describe("historical-import-service", () => {
  it("merges non-duplicate historical drafts into the ledger and skips duplicates", () => {
    const existingApproved = [createApprovedTransaction()];
    const existingAccounts = [createAccountSummary()];
    const duplicateDraft = createDraft();
    const uniqueDraft = createDraft({
      draftId: "draft-002",
      rawMessageId: "raw-002",
      occurredAt: "2026-02-10T08:00:00.000Z",
      amountMinor: 8000,
      feeMinor: 0,
      runningBalanceMinor: 993700,
      reportedBalanceMinor: 993700,
      title: "Fuel",
      merchantName: "Fuel",
      category: "transport",
      reference: "ref-002",
    });

    const result = importHistoricalTransactions({
      existingApprovedTransactions: existingApproved,
      existingApprovalQueue: [],
      existingAccountSummaries: existingAccounts,
      existingUnmatchedEntries: [],
      importedDrafts: [duplicateDraft, uniqueDraft],
      importedUnmatchedEntries: [],
      options: {
        mode: "merge",
        duplicateMode: "skip",
        defaultRecentReviewDays: 7,
        processedAt: "2026-05-01T12:00:00.000Z",
      },
    });

    expect(result.approvedTransactions).toHaveLength(2);
    expect(result.approvalQueue).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(result.skippedDuplicateCount).toBe(1);
    expect(result.approvedTransactions.map((item) => item.rawMessageId)).toEqual([
      "raw-001",
      "raw-002",
    ]);
    expect(result.accountSummaries[0]).toMatchObject({
      accountId: "acct-cbe-4920",
      balanceMinor: 993700,
    });
  });

  it("returns a backup snapshot before replacing imported slices", () => {
    const result = importHistoricalTransactions({
      existingApprovedTransactions: [createApprovedTransaction()],
      existingApprovalQueue: [
        {
          ...createDraft({
            draftId: "draft-queue-001",
            rawMessageId: "raw-queue-001",
            occurredAt: "2026-04-30T10:00:00.000Z",
          }),
          queueEntryId: "queue-001",
          queuedAt: "2026-04-30T10:05:00.000Z",
          approvalStatus: "pending_approval",
          note: "",
        },
      ],
      existingAccountSummaries: [createAccountSummary()],
      existingUnmatchedEntries: [createUnmatchedEntry()],
      importedDrafts: [
        createDraft({
          draftId: "draft-replace-001",
          rawMessageId: "raw-replace-001",
          accountReference: "7001",
          occurredAt: "2025-12-01T08:00:00.000Z",
          runningBalanceMinor: 450000,
          reportedBalanceMinor: 450000,
          reference: "ref-replace-001",
        }),
      ],
      importedUnmatchedEntries: [
        createUnmatchedEntry({
          unmatchedEntryId: "unmatched-import-001",
          rawMessageId: "raw-import-unmatched-001",
        }),
      ],
      options: {
        mode: "backup_then_replace",
        duplicateMode: "skip",
        defaultRecentReviewDays: 7,
        processedAt: "2026-05-01T12:00:00.000Z",
      },
    });

    expect(result.backupSnapshot).toBeDefined();
    expect(result.backupSnapshot?.approvedTransactions).toHaveLength(1);
    expect(result.backupSnapshot?.approvalQueue).toHaveLength(1);
    expect(result.backupSnapshot?.accountSummaries).toHaveLength(1);
    expect(result.backupSnapshot?.unmatchedEntries).toHaveLength(1);
    expect(result.approvedTransactions).toHaveLength(1);
    expect(result.approvedTransactions[0]?.rawMessageId).toBe("raw-replace-001");
    expect(result.approvalQueue).toHaveLength(0);
    expect(result.unmatchedEntries).toHaveLength(1);
    expect(result.unmatchedEntries[0]?.rawMessageId).toBe("raw-import-unmatched-001");
    expect(result.accountSummaries).toHaveLength(1);
    expect(result.accountSummaries[0]?.accountId).toBe("acct-cbe-7001");
  });

  it("routes recent drafts into the approval queue using per-account day overrides", () => {
    const approvedDraft = createDraft({
      draftId: "draft-cbe-001",
      rawMessageId: "raw-cbe-001",
      occurredAt: "2026-04-30T08:00:00.000Z",
      accountReference: "4920",
      runningBalanceMinor: 980000,
      reportedBalanceMinor: 980000,
    });
    const queuedDraft = createDraft({
      draftId: "draft-telebirr-001",
      rawMessageId: "raw-telebirr-001",
      senderLabel: "127",
      rawBody: "Telebirr credit",
      financialInstitution: "telebirr",
      accountChannel: "mobile_money",
      accountReference: "wallet-01",
      occurredAt: "2026-04-30T09:00:00.000Z",
      amountMinor: 25000,
      feeMinor: 0,
      runningBalanceMinor: 155000,
      reportedBalanceMinor: 155000,
      title: "Mint Cafe",
      merchantName: "Mint Cafe",
      category: "income",
      parserTemplateId: "telebirr_v1",
      reference: "ref-telebirr-001",
    });

    const result = importHistoricalTransactions({
      existingApprovedTransactions: [],
      existingApprovalQueue: [],
      existingAccountSummaries: [],
      existingUnmatchedEntries: [],
      importedDrafts: [approvedDraft, queuedDraft],
      importedUnmatchedEntries: [],
      options: {
        mode: "merge",
        duplicateMode: "skip",
        defaultRecentReviewDays: 0,
        recentReviewDaysByAccountKey: {
          [buildHistoricalImportAccountKey(queuedDraft)]: 7,
        },
        processedAt: "2026-05-01T12:00:00.000Z",
      },
    });

    expect(result.approvedTransactions).toHaveLength(1);
    expect(result.approvedTransactions[0]?.rawMessageId).toBe("raw-cbe-001");
    expect(result.approvalQueue).toHaveLength(1);
    expect(result.approvalQueue[0]).toMatchObject({
      rawMessageId: "raw-telebirr-001",
      approvalStatus: "pending_approval",
    });
    expect(result.accountSummaries.map((item) => item.accountId).sort()).toEqual([
      "acct-cbe-4920",
      "acct-telebirr-wallet-01",
    ]);
  });

  it("creates inferred account summaries when imports do not match an existing account", () => {
    const importedDraft = createDraft({
      draftId: "draft-new-account-001",
      rawMessageId: "raw-new-account-001",
      financialInstitution: "boa",
      accountReference: "700188",
      occurredAt: "2026-01-01T08:00:00.000Z",
      runningBalanceMinor: 305500,
      reportedBalanceMinor: 305500,
      title: "Salary",
      merchantName: "Employer",
      category: "income",
      parserTemplateId: "boa_v1",
      reference: "ref-new-account-001",
    });

    const result = importHistoricalTransactions({
      existingApprovedTransactions: [],
      existingApprovalQueue: [],
      existingAccountSummaries: [],
      existingUnmatchedEntries: [],
      importedDrafts: [importedDraft],
      importedUnmatchedEntries: [],
      options: {
        mode: "merge",
        duplicateMode: "skip",
        defaultRecentReviewDays: 7,
        processedAt: "2026-05-01T12:00:00.000Z",
      },
    });

    expect(result.approvedTransactions).toHaveLength(1);
    expect(result.inferredAccounts).toHaveLength(1);
    expect(result.accountSummaries[0]).toMatchObject({
      accountId: "acct-boa-700188",
      institutionName: "BOA",
      fullAccountNumber: "700188",
      balanceMinor: 305500,
      channel: "bank",
    });
  });
});
