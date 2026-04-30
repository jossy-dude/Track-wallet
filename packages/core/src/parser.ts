import type {
  FinancialInstitution,
  ParserMatchResult,
  ParsedTransactionDraft,
  RawSmsMessage,
  TransactionCategory,
  TransactionDirection,
} from "./types";

const KNOWN_SENDER_NAMES: Record<string, FinancialInstitution> = {
  cbe: "cbe",
  boa: "boa",
  "127": "telebirr",
  telebirr: "telebirr",
  cbebirr: "cbebirr",
  dashenbank: "dashen",
  dashen: "dashen",
  bunnabank: "bunna",
  bunna: "bunna",
};

interface ParserTemplateContext {
  rawSmsMessage: RawSmsMessage;
  senderKey: string;
}

interface TemplateMatch {
  financialInstitution: FinancialInstitution;
  transactionDirection: TransactionDirection;
  parserTemplateId: string;
  accountReference?: string;
  amountMinor: number;
  feeMinor?: number;
  runningBalanceMinor?: number;
  merchantName: string;
  title?: string;
  category?: TransactionCategory;
  occurredAt?: string;
  reference?: string;
}

interface ParserTemplate {
  id: string;
  senderKeys: readonly string[];
  matcher: (context: ParserTemplateContext) => TemplateMatch | null;
}

const TRANSACTION_HINT_RE =
  /\b(etb|br|debited|credited|transfer|transferred|received|paid|withdraw|withdrawn|recharged|deposit|voucher|balance)\b/i;

function normalizeSender(sender: string): string {
  return sender.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseMoneyMinor(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) {
    return 0;
  }

  const cleaned = match[0].replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function searchMoneyMinor(text: string, patterns: readonly RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseMoneyMinor(match[1]);
    }
  }

  return 0;
}

function extractTextValue(text: string, patterns: readonly RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return compactText(value.replace(/[.,:;-]+$/g, ""));
    }
  }

  return "";
}

function extractReference(text: string): string | undefined {
  const reference = extractTextValue(text, [
    /Ref No\s+([A-Z0-9]+)/i,
    /Txn ID\s+([A-Z0-9]+)/i,
    /transaction number is\s+([A-Z0-9]+)/i,
    /bank transaction number is\s+([A-Za-z0-9]+)/i,
    /trx=([A-Za-z0-9]+)/i,
    /voucher number is\s+([A-Za-z0-9]+)/i,
    /id=([A-Za-z0-9]+)/i,
  ]);

  return reference || undefined;
}

function computeConfidence(
  amountMinor: number,
  runningBalanceMinor: number,
  transactionDirection: TransactionDirection,
): number {
  let score = 0;

  if (amountMinor > 0) {
    score += 40;
  }
  if (runningBalanceMinor > 0) {
    score += 40;
  }
  if (transactionDirection) {
    score += 20;
  }

  return score;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .trim();
}

function extractOccurredAt(text: string, fallbackIso: string): string {
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    return new Date(`${dateMatch[1]}T00:00:00.000Z`).toISOString();
  }

  return new Date(fallbackIso).toISOString();
}

function inferCategory(
  transactionDirection: TransactionDirection,
  merchantName: string,
): TransactionCategory {
  const lowered = merchantName.toLowerCase();

  if (transactionDirection === "credit") {
    return "income";
  }
  if (/\b(grocery|market|restaurant|cafe|food|supermarket)\b/.test(lowered)) {
    return "food";
  }
  if (/\b(fuel|gas|transport|ride|taxi|bus|station)\b/.test(lowered)) {
    return "transport";
  }
  if (/\b(rent|landlord|apartment|housing|house)\b/.test(lowered)) {
    return "housing";
  }
  if (/\b(streaming|subscription|netflix|movie|music)\b/.test(lowered)) {
    return "entertainment";
  }

  return "misc";
}

function createDraft(
  rawSmsMessage: RawSmsMessage,
  match: TemplateMatch,
): ParsedTransactionDraft {
  const merchantName = compactText(match.merchantName);
  const title = compactText(match.title ?? toTitleCase(merchantName));

  return {
    draftId: `draft-${rawSmsMessage.messageId}`,
    rawMessageId: rawSmsMessage.messageId,
    senderLabel: rawSmsMessage.senderLabel,
    rawBody: rawSmsMessage.smsBody,
    financialInstitution: match.financialInstitution,
    transactionDirection: match.transactionDirection,
    amountMinor: match.amountMinor,
    feeMinor: match.feeMinor ?? 0,
    runningBalanceMinor: match.runningBalanceMinor ?? 0,
    currencyCode: "ETB",
    title,
    merchantName,
    category:
      match.category ?? inferCategory(match.transactionDirection, merchantName),
    parserTemplateId: match.parserTemplateId,
    confidence: computeConfidence(
      match.amountMinor,
      match.runningBalanceMinor ?? 0,
      match.transactionDirection,
    ),
    occurredAt:
      match.occurredAt ??
      extractOccurredAt(rawSmsMessage.smsBody, rawSmsMessage.receivedAt),
    accountReference: match.accountReference,
    reference: match.reference ?? extractReference(rawSmsMessage.smsBody),
    accountChannel:
      match.financialInstitution === "telebirr" || match.financialInstitution === "cbebirr"
        ? "mobile_money"
        : "bank",
  };
}

function parseGenericTemplateMatch(
  rawSmsMessage: RawSmsMessage,
  knownInstitution: FinancialInstitution | undefined,
): TemplateMatch | null {
  const runningBalanceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
    /current balance is\s*(?:ETB\s*)?([\d,.]+)/i,
    /available balance:\s*(?:ETB\s*)?([\d,.]+)/i,
    /avail\. bal:\s*(?:ETB\s*)?([\d,.]+)/i,
    /balance is\s*(?:ETB\s*)?([\d,.]+)/i,
  ]);
  const institution = knownInstitution ?? "unknown";

  if (/credited/i.test(rawSmsMessage.smsBody)) {
    const amountMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
      /credited(?: with)?\s*(?:ETB\s*)?([\d,.]+)/i,
      /credited with\s*([\d,.]+)br/i,
    ]);

    if (amountMinor <= 0) {
      return null;
    }

    return {
      financialInstitution: institution,
      transactionDirection: "credit",
      parserTemplateId: "generic_credit_v1",
      amountMinor,
      runningBalanceMinor,
      merchantName:
        extractTextValue(rawSmsMessage.smsBody, [/from\s+(.+?)\s+on/i]) ||
        "Generic Credit",
    };
  }

  if (/debited/i.test(rawSmsMessage.smsBody)) {
    const amountMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
      /debited(?: with)?\s*(?:ETB\s*)?([\d,.]+)/i,
      /debited with\s*([\d,.]+)br/i,
    ]);

    if (amountMinor <= 0) {
      return null;
    }

    return {
      financialInstitution: institution,
      transactionDirection: "debit",
      parserTemplateId: "generic_debit_v1",
      amountMinor,
      runningBalanceMinor,
      merchantName:
        extractTextValue(rawSmsMessage.smsBody, [/to\s+(.+?)\s+on/i]) ||
        extractTextValue(rawSmsMessage.smsBody, [/Info:\s*([^\.]+)/i]) ||
        "Generic Debit",
    };
  }

  if (/transfer(?:ed|red)|transferred/i.test(rawSmsMessage.smsBody)) {
    const amountMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
      /transfer(?:ed|red)\s*(?:ETB\s*)?([\d,.]+)/i,
      /transferred\s*([\d,.]+)br/i,
    ]);

    if (amountMinor <= 0) {
      return null;
    }

    return {
      financialInstitution: institution,
      transactionDirection: "transfer",
      parserTemplateId: "generic_transfer_v1",
      amountMinor,
      runningBalanceMinor,
      merchantName:
        extractTextValue(rawSmsMessage.smsBody, [/to\s+(.+?)\s+on/i]) ||
        "Generic Transfer",
    };
  }

  return null;
}

const PARSER_TEMPLATES: readonly ParserTemplate[] = [
  {
    id: "cbe_debit_v1",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /account\s+(?<account>\d{3,})\s+was debited with ETB\s*(?<amount>[\d,.]+)\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+at\s+(?<merchant>.+?)\.\s+Bal ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "cbe",
        transactionDirection: "debit",
        parserTemplateId: "cbe_debit_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
        occurredAt: new Date(`${match.groups.date}T00:00:00.000Z`).toISOString(),
      };
    },
  },
  {
    id: "cbe_credit_v1",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /Acct\s+(?<account>\d{3,})\s+credited with ETB\s*(?<amount>[\d,.]+)\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+from\s+(?<merchant>.+?)\.\s+Bal ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "cbe",
        transactionDirection: "credit",
        parserTemplateId: "cbe_credit_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
        occurredAt: new Date(`${match.groups.date}T00:00:00.000Z`).toISOString(),
      };
    },
  },
  {
    id: "cbe_received_to_account_v1",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have received ETB\s*(?<amount>[\d,.]+).*?to your account\s+(?<account>\d{3,}).*?current balance is ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      const merchantMatch =
        rawSmsMessage.smsBody.match(
          /from account\s+.+?\((?<merchant>.+?)\)\s+to your account/i,
        ) ??
        rawSmsMessage.smsBody.match(
          /from account\s+.+?\s+to your account/i,
        );

      return {
        financialInstitution: "cbe",
        transactionDirection: "credit",
        parserTemplateId: "cbe_received_to_account_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(
          merchantMatch?.groups?.merchant ?? "Incoming Transfer",
        ),
      };
    },
  },
  {
    id: "cbe_transfer_with_fees_v1",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have transfer(?:ed|red)\s+ETB\s*(?<amount>[\d,.]+)\s+to\s+(?<merchant>.+?)\s+on\s+(?<date>\d{4}-\d{2}-\d{2})/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /s\.charge of ETB\s*([\d,.]+)/i,
        /service charge of ETB\s*([\d,.]+)/i,
        /service charge ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT\(15%\)\s*(?:of\s+)?ETB\s*([\d,.]+)/i,
      ]);
      const disasterMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /disaster fund \(5%\)\s*(?:of\s+)?ETB\s*([\d,.]+)/i,
      ]);
      const runningBalanceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /current balance is ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "cbe",
        transactionDirection: "transfer",
        parserTemplateId: "cbe_transfer_with_fees_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: serviceMinor + vatMinor + disasterMinor,
        runningBalanceMinor,
        merchantName: compactText(match.groups.merchant),
        occurredAt: new Date(`${match.groups.date}T00:00:00.000Z`).toISOString(),
      };
    },
  },
  {
    id: "dashen_debit_v1",
    senderKeys: ["dashen", "dashenbank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /ETB\s*(?<amount>[\d,.]+)\s+paid from Acct\s+(?<account>\d{3,})\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+to\s+(?<merchant>.+?)\.\s+Bal ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "dashen",
        transactionDirection: "debit",
        parserTemplateId: "dashen_debit_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
        occurredAt: new Date(`${match.groups.date}T00:00:00.000Z`).toISOString(),
      };
    },
  },
  {
    id: "dashen_credit_v1",
    senderKeys: ["dashen", "dashenbank"],
    matcher: ({ rawSmsMessage }) => {
      const directCreditMatch = rawSmsMessage.smsBody.match(
        /credited with ETB\s*(?<amount>[\d,.]+)\s+from\s+(?<merchant>.+?)\s+on\s+(?<date>\d{4}-\d{2}-\d{2}).*?current balance is ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (directCreditMatch?.groups) {
        return {
          financialInstitution: "dashen",
          transactionDirection: "credit",
          parserTemplateId: "dashen_credit_v1",
          amountMinor: parseMoneyMinor(directCreditMatch.groups.amount),
          runningBalanceMinor: parseMoneyMinor(directCreditMatch.groups.balance),
          merchantName: compactText(directCreditMatch.groups.merchant),
          occurredAt: new Date(
            `${directCreditMatch.groups.date}T00:00:00.000Z`,
          ).toISOString(),
        };
      }

      const incomingTransferMatch = rawSmsMessage.smsBody.match(
        /Dear Customer,\s+(?<merchant>.+?)\s+has transferred ETB\s*(?<amount>[\d,.]+)\s+to your account.*?current balance is ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!incomingTransferMatch?.groups) {
        return null;
      }

      return {
        financialInstitution: "dashen",
        transactionDirection: "credit",
        parserTemplateId: "dashen_incoming_transfer_v1",
        amountMinor: parseMoneyMinor(incomingTransferMatch.groups.amount),
        runningBalanceMinor: parseMoneyMinor(incomingTransferMatch.groups.balance),
        merchantName: compactText(incomingTransferMatch.groups.merchant),
      };
    },
  },
  {
    id: "telebirr_credit_v1",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have received ETB\s*(?<amount>[\d,.]+).*?(?:from|payment from)\s+(?<merchant>.+?)\s+(?:mobile number|on)\b.*?balance is ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "telebirr",
        transactionDirection: "credit",
        parserTemplateId: "telebirr_credit_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "telebirr_paid_goods_v1",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have paid ETB\s*(?<amount>[\d,.]+).*?(?:goods purchased from|for package)\s+(?<merchant>.+?)\s+on/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service fee is ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT on the service fee is ETB\s*([\d,.]+)/i,
      ]);
      const runningBalanceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /current (?:e-money account\s+)?balance is ETB\s*([\d,.]+)/i,
        /balance is ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "telebirr",
        transactionDirection: "debit",
        parserTemplateId: "telebirr_paid_goods_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: serviceMinor + vatMinor,
        runningBalanceMinor,
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "telebirr_transfer_v1",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have transferred ETB\s*(?<amount>[\d,.]+)\s+to\s+(?<merchant>.+?)\s+on/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service fee is ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT on the service fee is ETB\s*([\d,.]+)/i,
      ]);
      const runningBalanceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /current (?:e-money account\s+)?balance is ETB\s*([\d,.]+)/i,
        /balance is ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "telebirr",
        transactionDirection: "transfer",
        parserTemplateId: "telebirr_transfer_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: serviceMinor + vatMinor,
        runningBalanceMinor,
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "telebirr_credit_v2",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have received\s*(?<amount>[\d,.]+)\s*ETB\s+from\s+(?<merchant>.+?)\.\s+your current balance is ETB\s*(?<balance>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "telebirr",
        transactionDirection: "credit",
        parserTemplateId: "telebirr_credit_v2",
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "cbebirr_transfer_v1",
    senderKeys: ["cbebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have made\s*(?<amount>[\d,.]+)br\s+transfer to\s+(?<merchant>.+?)\s+on.*?balance is\s*(?<balance>[\d,.]+)br/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "cbebirr",
        transactionDirection: "transfer",
        parserTemplateId: "cbebirr_transfer_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "cbebirr_airtime_purchase_v1",
    senderKeys: ["cbebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you bought\s*(?<amount>[\d,.]+)br\s+of airtime for\s+(?<merchant>.+?)\s+on.*?balance is\s*(?<balance>[\d,.]+)br/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "cbebirr",
        transactionDirection: "debit",
        parserTemplateId: "cbebirr_airtime_purchase_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant),
        category: "misc",
        title: "Airtime Purchase",
      };
    },
  },
  {
    id: "cbebirr_withdrawal_v1",
    senderKeys: ["cbebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have withdrawn\s*(?<amount>[\d,.]+)br.*?balance is\s*(?<balance>[\d,.]+)br/i,
      );
      if (!match?.groups) {
        return null;
      }

      const chargeMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /charge\s*([\d,.]+)br/i,
      ]);
      const taxMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /tax\s*([\d,.]+)br/i,
      ]);

      return {
        financialInstitution: "cbebirr",
        transactionDirection: "debit",
        parserTemplateId: "cbebirr_withdrawal_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: chargeMinor + taxMinor,
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: "CBE ATM",
        category: "misc",
        title: "ATM Withdrawal",
      };
    },
  },
  {
    id: "boa_credit_v1",
    senderKeys: ["boa"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /credited with ETB\s*(?<amount>[\d,.]+).*?(?:transfer made by|from)\s+(?<merchant>.+?)(?:\s+through|,|\.)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "boa",
        transactionDirection: "credit",
        parserTemplateId: "boa_credit_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "boa_debit_v1",
    senderKeys: ["boa"],
    matcher: ({ rawSmsMessage }) => {
      const amountMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /(?:was|has been)?\s*debited with ETB\s*([\d,.]+)/i,
      ]);
      if (amountMinor <= 0) {
        return null;
      }

      const description = extractTextValue(rawSmsMessage.smsBody, [
        /Info:\s*([^\.]+)/i,
        /transfer description\s+(.+?)\./i,
      ]);
      const runningBalanceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /avail\. bal:\s*ETB\s*([\d,.]+)/i,
        /available balance:\s*ETB\s*([\d,.]+)/i,
        /available balance in the account is ETB\s*([\d,.]+)/i,
        /the available balance in the account is ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "boa",
        transactionDirection: /transfer/i.test(rawSmsMessage.smsBody)
          ? "transfer"
          : "debit",
        parserTemplateId: "boa_debit_v1",
        amountMinor,
        runningBalanceMinor,
        merchantName: description || "BOA Debit",
      };
    },
  },
  {
    id: "bunna_credit_v1",
    senderKeys: ["bunna", "bunnabank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /deposit of\s*(?<amount>[\d,.]+)\s*etb.*?\bBY\s+(?:FROM\s+)?(?<merchant>.+?)\s+on\b/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "bunna",
        transactionDirection: "credit",
        parserTemplateId: "bunna_credit_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        merchantName: compactText(match.groups.merchant),
      };
    },
  },
  {
    id: "bunna_withdrawal_v1",
    senderKeys: ["bunna", "bunnabank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /withdrawal of\s*(?<amount>[\d,.]+)\s*etb.*?\bby\s+(?<merchant>.+?)(?:,|\s+)your current balance is\s*(?<balance>[\d,.]+)\s*etb/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "bunna",
        transactionDirection: "debit",
        parserTemplateId: "bunna_withdrawal_v1",
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: parseMoneyMinor(match.groups.balance),
        merchantName: compactText(match.groups.merchant.replace(/,$/, "")),
      };
    },
  },
] as const;

export { PARSER_TEMPLATES };

function runParser(rawSmsMessage: RawSmsMessage): ParserMatchResult {
  const senderKey = normalizeSender(rawSmsMessage.senderLabel);
  const matcherSmsMessage = {
    ...rawSmsMessage,
    smsBody: compactText(rawSmsMessage.smsBody),
  };
  const knownInstitution = KNOWN_SENDER_NAMES[senderKey];
  const candidateTemplates = PARSER_TEMPLATES.filter((template) =>
    template.senderKeys.includes(senderKey),
  );

  const templatesToTry = candidateTemplates;

  const strategy = templatesToTry.length > 0 ? templatesToTry[0] : null;
  console.log(`[Parser] Sender: ${senderKey}, Match Found: ${!!strategy}`);

  for (const template of templatesToTry) {
    const match = template.matcher({ rawSmsMessage: matcherSmsMessage, senderKey });
    if (!match) {
      continue;
    }

    return {
      status: "matched",
      draft: createDraft(rawSmsMessage, match),
    };
  }

  const genericMatch = TRANSACTION_HINT_RE.test(matcherSmsMessage.smsBody)
    ? parseGenericTemplateMatch(matcherSmsMessage, knownInstitution)
    : null;
  if (genericMatch) {
    return {
      status: "matched",
      draft: createDraft(rawSmsMessage, genericMatch),
    };
  }

  return {
    status: "unmatched",
    failureReason: "no_template_match",
    rawMessageId: rawSmsMessage.messageId,
    senderLabel: rawSmsMessage.senderLabel,
    smsBody: rawSmsMessage.smsBody,
  };
}

export function parseSmsMessage(rawSmsMessage: RawSmsMessage): ParserMatchResult {
  return runParser(rawSmsMessage);
}

export function parseIncomingSMS(rawSmsMessage: RawSmsMessage): ParserMatchResult {
  return runParser(rawSmsMessage);
}
