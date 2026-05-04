import { describe, expect, it } from "vitest";

import { parseSmsMessage } from "./parser";
import {
  buildParserRuntimeOptionsFromWorkspace,
  createDefaultParserTemplateWorkspace,
} from "./parserWorkspace";
import type { ParserTemplateDefinition, RawSmsMessage } from "./types";

function buildRuntimeTemplate(
  overrides: Partial<ParserTemplateDefinition> = {},
): ParserTemplateDefinition {
  return {
    id: "local_cbe_template_v1",
    financialInstitution: "cbe",
    institutionKey: "CBE",
    institutionLabel: "Commercial Bank of Ethiopia",
    institutionIcon: "account_balance",
    senderAliases: ["CBE"],
    accountIdentifiers: [],
    identityTextFragments: [],
    name: "Local CBE Template",
    version: "v0.1.0",
    updated: "Local draft",
    status: "active",
    regex:
      "amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
    note: "Local deterministic template for parser workspace tests.",
    healthScore: null,
    sourceType: "local",
    templateKind: "custom",
    engineEditable: true,
    userProfile: {
      senderAliases: ["CBE"],
      accountIdentifiers: [],
      identityTextFragments: [],
    },
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    dateMode: "captured_at",
    ...overrides,
  };
}

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
    expect(result.draft.reportedBalanceMinor).toBe(845000);
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
    expect(result.draft.reportedBalanceMinor).toBe(1245000);
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
    expect(result.draft.reportedBalanceMinor).toBe(150000);
    expect(result.draft.title).toBe("Mint Cafe");
    expect(result.draft.parserTemplateId).toBe("telebirr_credit_v2");
  });

  it("parses a CBE transfer with explicit service fees", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-transfer-001",
      senderLabel: "CBE",
      smsBody:
        "You have transferred ETB 300.00 to MINT CAFE on 2026-04-30. service charge of ETB 5.00 VAT(15%) of ETB 0.75 Current balance is ETB 8,144.25 Ref No ABC123",
      receivedAt: "2026-04-30T12:00:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the CBE transfer message");
    }

    expect(result.draft.transactionDirection).toBe("transfer");
    expect(result.draft.amountMinor).toBe(30000);
    expect(result.draft.feeMinor).toBe(575);
    expect(result.draft.runningBalanceMinor).toBe(814425);
    expect(result.draft.reportedBalanceMinor).toBe(814425);
    expect(result.draft.title).toBe("Mint Cafe");
    expect(result.draft.reference).toBe("ABC123");
    expect(result.draft.parserTemplateId).toBe("cbe_transfer_with_fees_v1");
  });

  it("parses a Telebirr merchant payment with service fee and vat", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-debit-001",
      senderLabel: "127",
      smsBody:
        "You have paid ETB 120.00 goods purchased from STREAMING SERVICE on 30/04/2026. current balance is ETB 1,677.70. service fee is ETB 2.00. VAT on the service fee is ETB 0.30.",
      receivedAt: "2026-04-30T12:05:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the Telebirr payment message");
    }

    expect(result.draft.financialInstitution).toBe("telebirr");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(12000);
    expect(result.draft.feeMinor).toBe(230);
    expect(result.draft.runningBalanceMinor).toBe(167770);
    expect(result.draft.reportedBalanceMinor).toBe(167770);
    expect(result.draft.title).toBe("Streaming Service");
    expect(result.draft.category).toBe("entertainment");
    expect(result.draft.parserTemplateId).toBe("telebirr_paid_goods_v1");
  });

  it("parses a BOA debit alert with available balance and info text", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-boa-debit-001",
      senderLabel: "BOA",
      smsBody:
        "Your account was debited with ETB 850.00. Info: RENT PAYMENT. Avail. Bal: ETB 4,150.00",
      receivedAt: "2026-04-30T12:10:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the BOA debit message");
    }

    expect(result.draft.financialInstitution).toBe("boa");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(85000);
    expect(result.draft.runningBalanceMinor).toBe(415000);
    expect(result.draft.reportedBalanceMinor).toBe(415000);
    expect(result.draft.title).toBe("Rent Payment");
    expect(result.draft.category).toBe("housing");
    expect(result.draft.parserTemplateId).toBe("boa_debit_v1");
  });

  it("parses a CBEBirr withdrawal with charge and tax", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbebirr-debit-001",
      senderLabel: "CBEBirr",
      smsBody:
        "You have withdrawn 500.00Br from CBE ATM. charge 5.00Br tax 0.75Br. balance is 1,244.25Br",
      receivedAt: "2026-04-30T12:15:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the CBEBirr withdrawal message");
    }

    expect(result.draft.financialInstitution).toBe("cbebirr");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(50000);
    expect(result.draft.feeMinor).toBe(575);
    expect(result.draft.runningBalanceMinor).toBe(124425);
    expect(result.draft.reportedBalanceMinor).toBe(124425);
    expect(result.draft.title).toBe("ATM Withdrawal");
    expect(result.draft.parserTemplateId).toBe("cbebirr_withdrawal_v1");
  });

  it("parses a Bunna withdrawal alert", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-bunna-debit-001",
      senderLabel: "BunnaBank",
      smsBody:
        "A withdrawal of 275.00 ETB has been made by ATM CASHOUT, your current balance is 2,025.00 ETB",
      receivedAt: "2026-04-30T12:20:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the Bunna withdrawal message");
    }

    expect(result.draft.financialInstitution).toBe("bunna");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(27500);
    expect(result.draft.runningBalanceMinor).toBe(202500);
    expect(result.draft.reportedBalanceMinor).toBe(202500);
    expect(result.draft.title).toBe("Atm Cashout");
    expect(result.draft.parserTemplateId).toBe("bunna_withdrawal_v1");
  });

  it("parses the newer CBE masked-account debit format with explicit fee components", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-debit-004",
      senderLabel: "CBE",
      smsBody:
        "Dear Sample User your Account 1*********3325 has been debited with ETB7,000.00. Service charge of ETB 10.00 and VAT(15%) of ETB1.50 and Disaster Fund (5%) of ETB0.50 with a total of ETB 7012.00. Your Current Balance is ETB 59,784.27. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT260837J8WX65063325",
      receivedAt: "2026-03-23T06:43:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the newer CBE debit format");
    }

    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(700000);
    expect(result.draft.feeMinor).toBe(1200);
    expect(result.draft.runningBalanceMinor).toBe(5978427);
    expect(result.draft.reportedBalanceMinor).toBe(5978427);
    expect(result.draft.accountReference).toBe("3325");
    expect(result.draft.title).toBe("Cbe Debit");
    expect(result.draft.reference).toBe("FT260837J8WX65063325");
    expect(result.draft.parserTemplateId).toBe("cbe_debit_masked_v2");
  });

  it("parses the newer CBE named credit format with a reference number", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-credit-003",
      senderLabel: "CBE",
      smsBody:
        "Dear Sample User your Account 1*********3325 has been Credited with ETB 3,000.00 from Sample Sender, on 04/12/2025 at 14:08:12 with Ref No FT25338KJ4QK Your Current Balance is ETB 30,642.91. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT25338KJ4QK65063325",
      receivedAt: "2025-12-04T14:08:30.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the newer CBE credit format");
    }

    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(300000);
    expect(result.draft.runningBalanceMinor).toBe(3064291);
    expect(result.draft.reportedBalanceMinor).toBe(3064291);
    expect(result.draft.accountReference).toBe("3325");
    expect(result.draft.title).toBe("Sample Sender");
    expect(result.draft.reference).toBe("FT25338KJ4QK");
    expect(result.draft.parserTemplateId).toBe("cbe_credit_masked_v2");
    expect(result.draft.occurredAt).toBe("2025-12-04T14:08:12.000Z");
  });

  it("parses the newer CBE transfer format with service, VAT, and disaster-fund fees", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-transfer-002",
      senderLabel: "CBE",
      smsBody:
        "Dear Sample User, You have transfered ETB 650.00 to Sample Recipient on 31/03/2026 at 13:28:54 from your account 1*********3325. Your account has been debited with a S.charge of ETB 0.50 and VAT(15%) of ETB0.08 and Disaster Fund (5%) of ETB0.03, with a total of ETB 650.61. Your Current Balance is ETB 109,324.83. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT260901LPVB65063325 For feedback click the link https://forms.gle/R1s9nkJ6qZVCxRVu9",
      receivedAt: "2026-03-31T13:29:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the newer CBE transfer format");
    }

    expect(result.draft.financialInstitution).toBe("cbe");
    expect(result.draft.transactionDirection).toBe("transfer");
    expect(result.draft.amountMinor).toBe(65000);
    expect(result.draft.feeMinor).toBe(61);
    expect(result.draft.runningBalanceMinor).toBe(10932483);
    expect(result.draft.reportedBalanceMinor).toBe(10932483);
    expect(result.draft.accountReference).toBe("3325");
    expect(result.draft.title).toBe("Sample Recipient");
    expect(result.draft.parserTemplateId).toBe("cbe_transfer_masked_v2");
    expect(result.draft.occurredAt).toBe("2026-03-31T13:28:54.000Z");
  });

  it("parses the real Dashen debit format with optional fee components", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-dashen-debit-002",
      senderLabel: "DashenBank",
      smsBody:
        "Dear Customer, your account 5049********011 has been debited with ETB 50,000.00 on 2025-10-14 at 04:57:56. A service fee of ETB 80 and VAT of ETB 12 have been applied. Your current balance is ETB 264.99. Thank you for using Dashen Super App! https://receipt.dashensuperapp.com/receipt/049OBTS25287012X",
      receivedAt: "2025-10-14T04:58:20.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the real Dashen debit format");
    }

    expect(result.draft.financialInstitution).toBe("dashen");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(5000000);
    expect(result.draft.feeMinor).toBe(9200);
    expect(result.draft.runningBalanceMinor).toBe(26499);
    expect(result.draft.reportedBalanceMinor).toBe(26499);
    expect(result.draft.accountReference).toBe("011");
    expect(result.draft.parserTemplateId).toBe("dashen_debit_masked_v2");
    expect(result.draft.occurredAt).toBe("2025-10-14T04:57:56.000Z");
  });

  it("parses the real Dashen credit format from another bank", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-dashen-credit-002",
      senderLabel: "DashenBank",
      smsBody:
        "Dear, SAMPLE USER Your Account '5049******011' has been credited with ETB 55,000.00 from other bank on 05/03/2026 at 11:18:09 AM. your current balance is ETB 55,064.12. Dashen Bank - Always one step ahead!",
      receivedAt: "2026-03-05T11:18:30.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the real Dashen credit format");
    }

    expect(result.draft.financialInstitution).toBe("dashen");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(5500000);
    expect(result.draft.runningBalanceMinor).toBe(5506412);
    expect(result.draft.reportedBalanceMinor).toBe(5506412);
    expect(result.draft.accountReference).toBe("011");
    expect(result.draft.title).toBe("Other Bank");
    expect(result.draft.parserTemplateId).toBe("dashen_credit_masked_v2");
    expect(result.draft.occurredAt).toBe("2026-03-05T11:18:09.000Z");
  });

  it("parses Dashen transfers into telebirr as transfers rather than plain debits", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-dashen-transfer-001",
      senderLabel: "DashenBank",
      smsBody:
        "Dear Customer, ETB 200.00 has been debited from your account 5049********011 and credited to the Telebirr account +251900000001 on 2026-01-16 at 08:26:36. A service fee of ETB 5 and VAT of ETB 0.75 have been applied Your current balance is ETB 63.47. Thank you for using the Dashen Super App! https://receipt.dashensuperapp.com/receipt/049LTWS260170004",
      receivedAt: "2026-01-16T08:26:50.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the Dashen telebirr transfer");
    }

    expect(result.draft.financialInstitution).toBe("dashen");
    expect(result.draft.transactionDirection).toBe("transfer");
    expect(result.draft.amountMinor).toBe(20000);
    expect(result.draft.feeMinor).toBe(575);
    expect(result.draft.runningBalanceMinor).toBe(6347);
    expect(result.draft.reportedBalanceMinor).toBe(6347);
    expect(result.draft.accountReference).toBe("011");
    expect(result.draft.title).toBe("Telebirr Account +251900000001");
    expect(result.draft.parserTemplateId).toBe("dashen_transfer_to_wallet_v1");
  });

  it("parses telebirr package purchases without swallowing the recipient phone number into the merchant name", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-debit-002",
      senderLabel: "127",
      smsBody:
        "Dear SAMPLE USER You have paid ETB 39.00 for package Daily Facebook, YouTube and TikTok package of 2.4 GB purchase made for 900000001 on 29/03/2026 13:03:41. Your transaction number is DCT4CJV59S. Your current balance is ETB 31.20.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DCT4CJV59S Thank you for using telebirr Ethio telecom",
      receivedAt: "2026-03-29T13:04:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the telebirr package purchase");
    }

    expect(result.draft.financialInstitution).toBe("telebirr");
    expect(result.draft.transactionDirection).toBe("debit");
    expect(result.draft.amountMinor).toBe(3900);
    expect(result.draft.runningBalanceMinor).toBe(3120);
    expect(result.draft.reportedBalanceMinor).toBe(3120);
    expect(result.draft.title).toBe(
      "Daily Facebook, Youtube And Tiktok Package Of 2.4 Gb",
    );
    expect(result.draft.merchantName).toBe(
      "Daily Facebook, YouTube and TikTok package of 2.4 GB",
    );
    expect(result.draft.reference).toBe("DCT4CJV59S");
    expect(result.draft.parserTemplateId).toBe("telebirr_paid_package_v2");
  });

  it("parses telebirr transfers to bank accounts with fee and VAT separation", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-transfer-002",
      senderLabel: "127",
      smsBody:
        "Dear SAMPLE USER You have transferred ETB 7,000.00 successfully from your telebirr account 251900000001 to Awash International Bank S C account number 01320822827500 on 24/03/2026 12:36:30. Your telebirr transaction number is DCO76JRJKL and your bank transaction number is 1119d1f33eb0eGnE. The service fee is ETB 13.04 and 15% VAT on the service fee is ETB 1.96. Your current balance is ETB 47.20. To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DCO76JRJKL Thank you for using telebirr Ethio telecom",
      receivedAt: "2026-03-24T12:37:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the telebirr bank transfer");
    }

    expect(result.draft.financialInstitution).toBe("telebirr");
    expect(result.draft.transactionDirection).toBe("transfer");
    expect(result.draft.amountMinor).toBe(700000);
    expect(result.draft.feeMinor).toBe(1500);
    expect(result.draft.runningBalanceMinor).toBe(4720);
    expect(result.draft.reportedBalanceMinor).toBe(4720);
    expect(result.draft.accountReference).toBe("01320822827500");
    expect(result.draft.title).toBe("Awash International Bank S C");
    expect(result.draft.reference).toBe("1119d1f33eb0eGnE");
    expect(result.draft.parserTemplateId).toBe("telebirr_transfer_bank_v2");
  });

  it("parses telebirr incoming transfers from bank accounts into the wallet", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-credit-003",
      senderLabel: "127",
      smsBody:
        "Dear SAMPLE USER, You have received ETB 7,000.00 by transaction number DCO16HRL8H on 2026-03-24 11:48:08 from Commercial Bank of Ethiopia to your telebirr Account 251900000001 - SAMPLE USER. Your current balance is ETB 7,314.20. Thank you for using telebirr Ethio telecom",
      receivedAt: "2026-03-24T11:48:40.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to match the telebirr bank-to-wallet credit");
    }

    expect(result.draft.financialInstitution).toBe("telebirr");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(700000);
    expect(result.draft.runningBalanceMinor).toBe(731420);
    expect(result.draft.reportedBalanceMinor).toBe(731420);
    expect(result.draft.accountReference).toBe("251900000001");
    expect(result.draft.title).toBe("Commercial Bank Of Ethiopia");
    expect(result.draft.reference).toBe("DCO16HRL8H");
    expect(result.draft.parserTemplateId).toBe("telebirr_bank_credit_v3");
    expect(result.draft.occurredAt).toBe("2026-03-24T11:48:08.000Z");
  });

  it("parses completed telebirr ATM cash-outs but leaves code-issue messages unmatched", () => {
    const completedRawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-debit-003",
      senderLabel: "127",
      smsBody:
        "Dear SAMPLE USER The request to withdraw ETB 200.00 from your telebirr account 251900000001 via secret code 426074 on 2025-09-26 16:50:59 using Awash International Bank S C ATM with transaction number CIQ84VHZT2 is successfully completed. The service fee (including 15% VAT) is ETB 1.15. Your current Account balance is ETB 70.80.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/CIQ84VHZT2 Thank you for using telebirr Ethio telecom",
      receivedAt: "2025-09-26T16:51:20.000Z",
    };

    const completedResult = parseSmsMessage(completedRawSmsMessage);

    expect(completedResult.status).toBe("matched");
    if (completedResult.status !== "matched") {
      throw new Error("Expected parser to match the completed telebirr ATM cash-out");
    }

    expect(completedResult.draft.financialInstitution).toBe("telebirr");
    expect(completedResult.draft.transactionDirection).toBe("debit");
    expect(completedResult.draft.amountMinor).toBe(20000);
    expect(completedResult.draft.feeMinor).toBe(115);
    expect(completedResult.draft.runningBalanceMinor).toBe(7080);
    expect(completedResult.draft.reportedBalanceMinor).toBe(7080);
    expect(completedResult.draft.title).toBe("Awash International Bank S C ATM");
    expect(completedResult.draft.reference).toBe("CIQ84VHZT2");
    expect(completedResult.draft.parserTemplateId).toBe("telebirr_atm_withdrawal_v1");

    const secretCodeRawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-noise-002",
      senderLabel: "127",
      smsBody:
        "Dear Customer, Your ATM withdrawal secret code is 426074 for an amount of ETB 200.00. Please use this code before 2025-09-26 18:23:16 at any BoA or Awash Bank ATM. For more information, please call 127 or visit www.ethiotelecom.et. Thank you for using telebirr. Ethio telecom",
      receivedAt: "2025-09-26T16:50:10.000Z",
    };

    expect(parseSmsMessage(secretCodeRawSmsMessage)).toEqual({
      status: "unmatched",
      failureReason: "no_template_match",
      rawMessageId: "sms-telebirr-noise-002",
      senderLabel: "127",
      smsBody:
        "Dear Customer, Your ATM withdrawal secret code is 426074 for an amount of ETB 200.00. Please use this code before 2025-09-26 18:23:16 at any BoA or Awash Bank ATM. For more information, please call 127 or visit www.ethiotelecom.et. Thank you for using telebirr. Ethio telecom",
    });
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

  it("falls back to a generic deterministic parse for unknown transactional senders", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-generic-credit-001",
      senderLabel: "MYSTERYBANK",
      smsBody:
        "Your wallet has been credited with ETB 95.00 from COFFEE SHOP on 2026-04-30. current balance is ETB 1,205.00",
      receivedAt: "2026-04-30T12:25:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage);

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected parser to fall back to a generic credit parse");
    }

    expect(result.draft.financialInstitution).toBe("unknown");
    expect(result.draft.transactionDirection).toBe("credit");
    expect(result.draft.amountMinor).toBe(9500);
    expect(result.draft.runningBalanceMinor).toBe(120500);
    expect(result.draft.reportedBalanceMinor).toBe(120500);
    expect(result.draft.title).toBe("Coffee Shop");
    expect(result.draft.parserTemplateId).toBe("generic_credit_v1");
  });

  it("matches a runtime template pack when a local template is provided", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-runtime-local-001",
      senderLabel: "CBE",
      smsBody: "Manual parser test amount 88.50 merchant MINT CAFE balance 1,205.40",
      receivedAt: "2026-05-02T08:00:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage, {
      templates: [
        buildRuntimeTemplate({
          id: "local_cbe_manual_v1",
          regex:
            "Manual parser test amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
        }),
      ],
    });

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected runtime parser template to match the custom message");
    }

    expect(result.draft.parserTemplateId).toBe("local_cbe_manual_v1");
    expect(result.draft.amountMinor).toBe(8850);
    expect(result.draft.runningBalanceMinor).toBe(120540);
    expect(result.draft.title).toBe("Mint Cafe");
  });

  it("ignores draft templates unless draft parsing is explicitly enabled", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-runtime-draft-001",
      senderLabel: "CBE",
      smsBody:
        "Shared pattern amount 125.00 merchant LOCAL MARKET balance 2,100.00",
      receivedAt: "2026-05-02T08:05:00.000Z",
    };

    const activeTemplate = buildRuntimeTemplate({
      id: "local_cbe_active_v1",
      name: "Active Runtime Template",
      status: "active",
      regex:
        "Shared pattern amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
    });
    const draftTemplate = buildRuntimeTemplate({
      id: "local_cbe_draft_v1",
      name: "Draft Runtime Template",
      status: "draft",
      regex:
        "Shared pattern amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
    });

    const result = parseSmsMessage(rawSmsMessage, {
      templates: [activeTemplate, draftTemplate],
      preferredTemplateId: draftTemplate.id,
    });

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected the active runtime template to match the shared message");
    }

    expect(result.draft.parserTemplateId).toBe(activeTemplate.id);
  });

  it("prefers the selected draft template when draft parsing is enabled", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-runtime-draft-002",
      senderLabel: "CBE",
      smsBody:
        "Selected pattern amount 140.00 merchant COFFEE CORNER balance 905.20",
      receivedAt: "2026-05-02T08:10:00.000Z",
    };

    const activeTemplate = buildRuntimeTemplate({
      id: "local_cbe_active_v2",
      name: "Active Runtime Template",
      status: "active",
      regex:
        "Selected pattern amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
    });
    const draftTemplate = buildRuntimeTemplate({
      id: "local_cbe_draft_v2",
      name: "Draft Runtime Template",
      status: "draft",
      regex:
        "Selected pattern amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
    });

    const result = parseSmsMessage(rawSmsMessage, {
      templates: [activeTemplate, draftTemplate],
      preferredTemplateId: draftTemplate.id,
      includeDraftTemplates: true,
    });

    expect(result.status).toBe("matched");
    if (result.status !== "matched") {
      throw new Error("Expected the preferred draft runtime template to match");
    }

    expect(result.draft.parserTemplateId).toBe(draftTemplate.id);
  });

  it("ignores disabled templates from a runtime template pack", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-runtime-disabled-001",
      senderLabel: "CBE",
      smsBody:
        "Disabled pattern amount 63.50 merchant NIGHT SHOP balance 505.20",
      receivedAt: "2026-05-02T08:15:00.000Z",
    };

    const result = parseSmsMessage(rawSmsMessage, {
      templates: [
        buildRuntimeTemplate({
          id: "local_cbe_disabled_v1",
          status: "disabled",
          regex:
            "Disabled pattern amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
        }),
      ],
      includeDraftTemplates: true,
    });

    expect(result).toEqual({
      status: "unmatched",
      failureReason: "no_template_match",
      rawMessageId: "sms-runtime-disabled-001",
      senderLabel: "CBE",
      smsBody:
        "Disabled pattern amount 63.50 merchant NIGHT SHOP balance 505.20",
    });
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

  it("routes the same bank family to the correct account-specific binding", () => {
    const workspace = createDefaultParserTemplateWorkspace();
    workspace.accountBindings.push(
      {
        accountId: "acct-cbe-4920",
        accountLabel: "CBE Personal 4920",
        accountChannel: "bank",
        financialInstitution: "cbe",
        institutionKey: "CBE",
        status: "active",
        userProfile: {
          senderAliases: ["CBE"],
          accountIdentifiers: ["4920"],
          identityTextFragments: [],
        },
      },
      {
        accountId: "acct-cbe-7001",
        accountLabel: "CBE Savings 7001",
        accountChannel: "bank",
        financialInstitution: "cbe",
        institutionKey: "CBE",
        status: "active",
        userProfile: {
          senderAliases: ["CBE"],
          accountIdentifiers: ["7001"],
          identityTextFragments: [],
        },
      },
    );

    const runtime = buildParserRuntimeOptionsFromWorkspace(workspace);
    const firstResult = parseSmsMessage(
      {
        messageId: "binding-001",
        senderLabel: "CBE",
        smsBody:
          "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
        receivedAt: "2026-04-29T08:10:00.000Z",
      },
      runtime,
    );
    const secondResult = parseSmsMessage(
      {
        messageId: "binding-002",
        senderLabel: "CBE",
        smsBody:
          "CBE ALERT: Your account 7001 was debited with ETB 550.00 on 2026-04-29 at FUEL STATION. Bal ETB 9450.00",
        receivedAt: "2026-04-29T08:10:00.000Z",
      },
      runtime,
    );

    expect(firstResult.status).toBe("matched");
    expect(secondResult.status).toBe("matched");
    if (firstResult.status !== "matched" || secondResult.status !== "matched") {
      throw new Error("Expected both parser results to match");
    }

    expect(firstResult.draft.parserTemplateId).toBe("cbe_debit_v1::acct-cbe-4920");
    expect(secondResult.draft.parserTemplateId).toBe("cbe_debit_v1::acct-cbe-7001");
  });
});
