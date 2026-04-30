import { describe, expect, it } from "vitest";

import { parseSmsMessage } from "../../core/src/parser";
import type { RawSmsMessage } from "../../core/src/types";
import {
  buildDashboardSnapshot,
  createTransactionStore,
} from "./transaction-store";

describe("createTransactionStore", () => {
  it("seeds demo data for the current mobile dashboard slice", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();

    const state = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(state);

    expect(state.approvalQueue).toHaveLength(3);
    expect(state.approvedTransactions).toHaveLength(3);
    expect(state.accountSummaries).toHaveLength(4);
    expect(state.budgetSummaries).toHaveLength(5);
    expect(dashboardSnapshot.totalBalanceMinor).toBe(1425000);
    expect(dashboardSnapshot.pendingApprovalCount).toBe(3);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(3);
    expect(dashboardSnapshot.balanceByChannel).toEqual({
      bank: 1200000,
      mobile_money: 180000,
      cash: 45000,
    });
  });

  it("queues a parsed SMS draft for manual review", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-debit-queue-001",
      senderLabel: "CBE",
      smsBody:
        "CBE ALERT: Your account 4920 was debited with ETB 320.00 on 2026-04-30 at CITY MARKET. Bal ETB 8130.00",
      receivedAt: "2026-04-30T09:10:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "matched") {
      throw new Error("Expected parser to create a draft for queueing");
    }

    const transactionStore = createTransactionStore();
    const queuedDraft = transactionStore
      .getState()
      .queueParsedTransaction(parseResult.draft, "2026-04-30T09:10:30.000Z");

    const state = transactionStore.getState();

    expect(state.approvalQueue).toHaveLength(1);
    expect(state.approvalQueue[0]?.queueEntryId).toBe(queuedDraft.queueEntryId);
    expect(state.approvalQueue[0]?.approvalStatus).toBe("pending_approval");
    expect(state.approvalQueue[0]?.title).toBe("City Market");
    expect(state.approvalQueue[0]?.queuedAt).toBe("2026-04-30T09:10:30.000Z");
  });

  it("captures unmatched SMS into a raw review lane without polluting the approval queue", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-unknown-raw-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
      receivedAt: "2026-04-30T13:30:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "unmatched") {
      throw new Error("Expected parser to leave this message unmatched");
    }

    const transactionStore = createTransactionStore();
    const unmatchedEntry = transactionStore
      .getState()
      .captureUnmatchedSms(rawSmsMessage, parseResult, "2026-04-30T13:30:30.000Z");

    const state = transactionStore.getState();

    expect(state.approvalQueue).toHaveLength(0);
    expect(state.unmatchedMessages).toHaveLength(1);
    expect(state.unmatchedMessages[0]?.unmatchedEntryId).toBe(
      unmatchedEntry.unmatchedEntryId,
    );
    expect(state.unmatchedMessages[0]).toMatchObject({
      rawMessageId: "sms-unknown-raw-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
      failureReason: "no_template_match",
      capturedAt: "2026-04-30T13:30:30.000Z",
    });
  });

  it("updates or creates account summaries only after approval", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-credit-queue-001",
      senderLabel: "127",
      smsBody:
        "You have received 250.00 ETB from MINT CAFE. Your current balance is ETB 1,500.00.",
      receivedAt: "2026-04-30T11:05:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "matched") {
      throw new Error("Expected parser to create a Telebirr draft for queueing");
    }

    const transactionStore = createTransactionStore();

    const queueEntry = transactionStore
      .getState()
      .queueParsedTransaction(parseResult.draft, "2026-04-30T11:05:30.000Z");

    expect(transactionStore.getState().accountSummaries).toHaveLength(0);

    transactionStore
      .getState()
      .approveQueueItem(queueEntry.queueEntryId, "2026-04-30T11:06:00.000Z");

    const state = transactionStore.getState();

    expect(state.accountSummaries).toHaveLength(1);
    expect(state.accountSummaries[0]).toMatchObject({
      institutionName: "Telebirr",
      maskedAccountNumber: "Unknown account",
      balanceMinor: 150000,
      channel: "mobile_money",
      iconName: "phone_iphone",
      tone: "secondary",
    });
  });

  it("edits a queued transaction and approves it into the dashboard ledger", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    const queueEntryId = transactionStore.getState().approvalQueue[0]?.queueEntryId;
    if (!queueEntryId) {
      throw new Error("Expected seeded demo data to include a queue entry");
    }

    transactionStore.getState().openTransactionEditor(queueEntryId);
    transactionStore.getState().editApprovalQueueItem(queueEntryId, {
      title: "Neighborhood Grocery",
      category: "food",
      note: "Weekend family shopping",
    });

    const approvedTransaction = transactionStore
      .getState()
      .approveQueueItem(queueEntryId, "2026-04-30T10:00:00.000Z");

    const nextState = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(nextState);

    expect(approvedTransaction?.title).toBe("Neighborhood Grocery");
    expect(approvedTransaction?.category).toBe("food");
    expect(approvedTransaction?.note).toBe("Weekend family shopping");
    expect(nextState.approvalQueue).toHaveLength(2);
    expect(nextState.approvedTransactions).toHaveLength(4);
    expect(nextState.activeQueueEntryId).toBeNull();
    expect(dashboardSnapshot.pendingApprovalCount).toBe(2);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(4);
    expect(
      nextState.budgetSummaries.find((summary) => summary.category === "food")
        ?.spentMinor,
    ).toBe(90000);
  });

  it("can clear persisted finance state so the browser can render a true empty view", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.getState().captureUnmatchedSms(
      {
        messageId: "sms-unknown-raw-002",
        senderLabel: "Unknown Sender",
        smsBody: "Lunch tomorrow at 1pm?",
        receivedAt: "2026-04-30T13:35:00.000Z",
      },
      {
        status: "unmatched",
        failureReason: "no_template_match",
        rawMessageId: "sms-unknown-raw-002",
        senderLabel: "Unknown Sender",
        smsBody: "Lunch tomorrow at 1pm?",
      },
      "2026-04-30T13:35:30.000Z",
    );
    transactionStore.getState().clearAllData();

    const state = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(state);

    expect(state.hasInitialized).toBe(true);
    expect(state.approvalQueue).toHaveLength(0);
    expect(state.approvedTransactions).toHaveLength(0);
    expect(state.accountSummaries).toHaveLength(0);
    expect(state.budgetSummaries).toHaveLength(0);
    expect(state.unmatchedMessages).toHaveLength(0);
    expect(state.activeQueueEntryId).toBeNull();
    expect(dashboardSnapshot.totalBalanceMinor).toBe(0);
    expect(dashboardSnapshot.pendingApprovalCount).toBe(0);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(0);
  });
});
