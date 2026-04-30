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
    confidence: 100,
    occurredAt:
      match.occurredAt ??
      extractOccurredAt(rawSmsMessage.smsBody, rawSmsMessage.receivedAt),
    accountReference: match.accountReference,
    reference: match.reference,
    accountChannel:
      match.financialInstitution === "telebirr" || match.financialInstitution === "cbebirr"
        ? "mobile_money"
        : "bank",
  };
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

  const templatesToTry =
    candidateTemplates.length > 0
      ? candidateTemplates
      : knownInstitution || TRANSACTION_HINT_RE.test(matcherSmsMessage.smsBody)
        ? PARSER_TEMPLATES
        : [];

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
