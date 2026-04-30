import { describe, expect, it } from "vitest";

import { parseSmsMessage } from "./parser";
import type { RawSmsMessage } from "./types";

describe("parseSmsMessage", () => {
  it("parses a CBE debit alert into an approval-ready draft", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-debit-001",
      senderLabel: "CBE",
      smsBody:
        "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
      receivedAt: "2026-04-29T08:10:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the CBE debit message");
    }

    expect(result.draft.draftId).toBe("draft-sms-cbe-debit-001");
    expect(result.draft.rawMessageId).toBe("sms-cbe-debit-001");
    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.accountReference).toBe("4920");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(45000);
    expect(result.draft.currencyCode).toBe("ETB");
    expect(result.draft.title).toBe("Grocery Store");
    expect(result.draft.merchantName).toBe("GROCERY STORE");
    expect(result.draft.category).toBe("food");
    expect(result.draft.runningBalanceMinor).toBe(845000);
    expect(result.draft.parserTemplateId).toBe("cbe_debit_v1");
    expect(result.draft.occurredAt).toBe("2026-04-29T00:00:00.000Z");
  });

  it("parses a Dashen fuel payment and infers a transport category", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-dashen-debit-001",
      senderLabel: "Dashen",
      smsBody:
        "Dashen Alert: ETB 180.00 paid from Acct 1104 on 2026-04-28 to FUEL STATION. Bal ETB 3550.00",
      receivedAt: "2026-04-28T12:30:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the Dashen payment message");
    }

    expect(result.draft.financialInstitution).toBe("dashen");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(18000);
    expect(result.draft.title).toBe("Fuel Station");
    expect(result.draft.category).toBe("transport");
    expect(result.draft.parserTemplateId).toBe("dashen_debit_v1");
  });

  it("parses a credited salary alert as income", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-credit-001",
      senderLabel: "CBE",
      smsBody:
        "CBE ALERT: Acct 4920 credited with ETB 12500.00 on 2026-04-30 from SALARY ACME LTD. Bal ETB 20950.00",
      receivedAt: "2026-04-30T06:40:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the CBE credit message");
    }

    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.category).toBe("income");
    expect(result.draft.amountMinor).toBe(1250000);
    expect(result.draft.title).toBe("Salary Acme Ltd");
    expect(result.draft.parserTemplateId).toBe("cbe_credit_v1");
  });

  it("parses the CBE received-to-account pattern from the legacy parser family", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-credit-002",
      senderLabel: "CBE",
      smsBody:
        "Dear Customer, you have received ETB 2,500.00 from account 1000665063325 (ACME PLC) to your account 3325. Current balance is ETB 12,450.00",
      receivedAt: "2026-04-30T11:00:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the legacy CBE received pattern");
    }

    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(250000);
    expect(result.draft.accountReference).toBe("3325");
    expect(result.draft.runningBalanceMinor).toBe(1245000);
    expect(result.draft.title).toBe("Acme Plc");
    expect(result.draft.parserTemplateId).toBe("cbe_received_to_account_v1");
  });

  it("parses the Telebirr received-amount-before-etb pattern from the legacy parser family", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-credit-002",
      senderLabel: "127",
      smsBody:
        "You have received 250.00 ETB from MINT CAFE. Your current balance is ETB 1,500.00.",
      receivedAt: "2026-04-30T11:05:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the Telebirr received pattern");
    }

    expect(result.draft.financialInstitution).toBe("telebirr");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(25000);
    expect(result.draft.runningBalanceMinor).toBe(150000);
    expect(result.draft.title).toBe("Mint Cafe");
    expect(result.draft.parserTemplateId).toBe("telebirr_credit_v2");
  });

  it("normalizes sender casing and collapses irregular whitespace before matching", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-debit-003",
      senderLabel: "  CbE  ",
      smsBody:
        "CBE ALERT:   Your   account  4920   was debited with ETB  450.00   on  2026-04-29  at  GROCERY STORE.  Bal ETB  8450.00",
      receivedAt: "2026-04-29T08:10:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match after sender and whitespace normalization");
    }

    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(45000);
    expect(result.draft.parserTemplateId).toBe("cbe_debit_v1");
  });

  it("returns an unmatched result when no starter template applies", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-unknown-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
      receivedAt: "2026-04-30T09:00:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result).toEqual({
      status: "unmatched",
      failureReason: "no_template_match",
      rawMessageId: "sms-unknown-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
    });
  });
});
