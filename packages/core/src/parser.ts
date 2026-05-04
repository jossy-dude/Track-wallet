import type {
  AccountChannel,
  FinancialInstitution,
  ParserMatchResult,
  ParserRuntimeOptions,
  ParserTemplateDefinition,
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
  accountChannel?: AccountChannel;
}

interface ParserTemplate {
  id: string;
  senderKeys: readonly string[];
  matcher: (context: ParserTemplateContext) => TemplateMatch | null;
}

const TRANSACTION_HINT_RE =
  /\b(etb|br|debited|credited|transfer|transferred|received|paid|withdraw|withdrawn|recharged|deposit|voucher|balance)\b/i;
const compiledRuntimeRegexCache = new Map<string, RegExp>();
const templateStatusPriority = {
  active: 0,
  fallback: 1,
  draft: 2,
  disabled: 3,
} as const;

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

function parseOccurredAtValue(
  dateValue: string | undefined,
  timeValue?: string,
  meridiemValue?: string,
): string | undefined {
  if (!dateValue) {
    return undefined;
  }

  const normalizedDate = dateValue.trim();
  const normalizedTime = (timeValue?.trim() || "00:00:00").padEnd(8, "0");
  const meridiem = meridiemValue?.trim().toUpperCase();

  let year = 0;
  let month = 0;
  let day = 0;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const [rawYear, rawMonth, rawDay] = normalizedDate.split("-");
    year = Number.parseInt(rawYear, 10);
    month = Number.parseInt(rawMonth, 10);
    day = Number.parseInt(rawDay, 10);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalizedDate)) {
    const [rawDay, rawMonth, rawYear] = normalizedDate.split("/");
    year = Number.parseInt(rawYear, 10);
    month = Number.parseInt(rawMonth, 10);
    day = Number.parseInt(rawDay, 10);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(normalizedDate)) {
    const [rawDay, rawMonth, rawYear] = normalizedDate.split("-");
    year = Number.parseInt(rawYear, 10);
    month = Number.parseInt(rawMonth, 10);
    day = Number.parseInt(rawDay, 10);
  } else {
    return undefined;
  }

  const [rawHour = "00", rawMinute = "00", rawSecond = "00"] = normalizedTime.split(":");
  let hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);
  const second = Number.parseInt(rawSecond, 10);

  if (meridiem === "PM" && hour < 12) {
    hour += 12;
  } else if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

function computeFeeMinor(
  amountMinor: number,
  components: readonly number[],
  totalMinor = 0,
): number {
  const explicitFeeMinor = components.reduce((sum, value) => sum + value, 0);
  if (explicitFeeMinor > 0) {
    return explicitFeeMinor;
  }

  if (totalMinor > amountMinor) {
    return totalMinor - amountMinor;
  }

  return 0;
}

function getDefaultAccountChannel(
  financialInstitution: FinancialInstitution,
): AccountChannel {
  return financialInstitution === "telebirr" || financialInstitution === "cbebirr"
    ? "mobile_money"
    : "bank";
}

function extractGroupValue(
  groups: Record<string, string> | undefined,
  ...keys: Array<string | undefined>
): string | undefined {
  if (!groups) {
    return undefined;
  }

  for (const key of keys) {
    if (!key) {
      continue;
    }

    const value = groups[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function compileRuntimeTemplateRegex(
  template: ParserTemplateDefinition,
): RegExp | null {
  const cacheKey = `${template.id}:${template.regex}`;
  const cached = compiledRuntimeRegexCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const compiled = new RegExp(template.regex, "i");
    compiledRuntimeRegexCache.set(cacheKey, compiled);
    return compiled;
  } catch {
    return null;
  }
}

function templateSupportsSender(
  template: ParserTemplateDefinition,
  senderKey: string,
): boolean {
  if (template.senderAliases.length === 0) {
    return true;
  }

  return template.senderAliases.some(
    (alias) => normalizeSender(alias) === senderKey,
  );
}

function normalizeProfileFragment(value: string): string {
  return compactText(value).toLowerCase();
}

function templateMatchesProfileConstraints(
  template: ParserTemplateDefinition,
  rawSmsMessage: RawSmsMessage,
  accountReference: string | undefined,
): boolean {
  const compactedBody = compactText(rawSmsMessage.smsBody).toLowerCase();
  const normalizedAccountReference = accountReference
    ? normalizeProfileFragment(accountReference)
    : "";

  if (template.accountIdentifiers.length > 0) {
    const accountMatched = template.accountIdentifiers.some((identifier) => {
      const normalizedIdentifier = normalizeProfileFragment(identifier);
      return (
        normalizedIdentifier.length > 0 &&
        (normalizedAccountReference.includes(normalizedIdentifier) ||
          compactedBody.includes(normalizedIdentifier))
      );
    });

    if (!accountMatched) {
      return false;
    }
  }

  if (template.identityTextFragments.length > 0) {
    const identityMatched = template.identityTextFragments.some((fragment) => {
      const normalizedFragment = normalizeProfileFragment(fragment);
      return (
        normalizedFragment.length > 0 &&
        compactedBody.includes(normalizedFragment)
      );
    });

    if (!identityMatched) {
      return false;
    }
  }

  return true;
}

function buildRuntimeTemplateMatch(
  rawSmsMessage: RawSmsMessage,
  senderKey: string,
  template: ParserTemplateDefinition,
): TemplateMatch | null {
  if (!templateSupportsSender(template, senderKey)) {
    return null;
  }

  const compiledRegex = compileRuntimeTemplateRegex(template);
  if (!compiledRegex) {
    return null;
  }

  const compactedBody = compactText(rawSmsMessage.smsBody);
  const match = compactedBody.match(compiledRegex);
  if (!match?.groups) {
    return null;
  }

  const amountMinor = parseMoneyMinor(
    extractGroupValue(match.groups, template.amountKey),
  );
  if (amountMinor <= 0) {
    return null;
  }
  const accountReference = extractGroupValue(match.groups, template.accountKey);

  if (!templateMatchesProfileConstraints(template, rawSmsMessage, accountReference)) {
    return null;
  }

  const merchantValue = extractGroupValue(
    match.groups,
    template.merchantKey,
    template.titleKey,
  );
  const rawTitleValue = extractGroupValue(
    match.groups,
    template.titleKey,
    template.merchantKey,
  );
  const balanceMinor = parseMoneyMinor(
    extractGroupValue(match.groups, template.balanceKey),
  );
  const feeMinor = computeFeeMinor(
    amountMinor,
    [
      parseMoneyMinor(extractGroupValue(match.groups, template.feeKey)),
      parseMoneyMinor(extractGroupValue(match.groups, template.vatKey)),
      parseMoneyMinor(extractGroupValue(match.groups, template.extraFeeKey)),
    ],
    parseMoneyMinor(extractGroupValue(match.groups, template.totalKey)),
  );

  const occurredAt =
    template.dateMode === "captured_at"
      ? new Date(rawSmsMessage.receivedAt).toISOString()
      : parseOccurredAtValue(
          extractGroupValue(match.groups, template.dateKey),
          extractGroupValue(match.groups, template.timeKey),
          extractGroupValue(match.groups, template.meridiemKey),
        );

  return {
    financialInstitution: template.financialInstitution,
    transactionDirection: template.direction,
    parserTemplateId: template.id,
    accountReference,
    amountMinor,
    feeMinor,
    runningBalanceMinor: balanceMinor,
    merchantName: merchantValue ?? template.name,
    title:
      template.preserveTitleCase && rawTitleValue
        ? compactText(rawTitleValue)
        : undefined,
    category: template.category,
    occurredAt,
    reference: extractGroupValue(match.groups, template.referenceKey),
    accountChannel:
      template.accountChannel ??
      getDefaultAccountChannel(template.financialInstitution),
  };
}

function getRuntimeTemplatesToTry(
  senderKey: string,
  options: ParserRuntimeOptions,
): ParserTemplateDefinition[] {
  const includeDraftTemplates = options.includeDraftTemplates ?? false;

  return (options.templates ?? [])
    .filter((template) => templateSupportsSender(template, senderKey))
    .filter((template) => template.status !== "disabled")
    .filter((template) => includeDraftTemplates || template.status !== "draft")
    .map((template, index) => ({ template, index }))
    .sort((left, right) => {
      const leftPreferred = left.template.id === options.preferredTemplateId ? -1 : 0;
      const rightPreferred = right.template.id === options.preferredTemplateId ? -1 : 0;

      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }

      const leftStatusPriority = templateStatusPriority[left.template.status];
      const rightStatusPriority = templateStatusPriority[right.template.status];
      if (leftStatusPriority !== rightStatusPriority) {
        return leftStatusPriority - rightStatusPriority;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.template);
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
    reportedBalanceMinor:
      match.runningBalanceMinor && match.runningBalanceMinor > 0
        ? match.runningBalanceMinor
        : undefined,
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
      match.accountChannel ?? getDefaultAccountChannel(match.financialInstitution),
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
    id: "cbe_transfer_masked_v2",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have transfer(?:ed|red)\s+ETB\s*(?<amount>[\d,.]+)\s+to\s+(?<merchant>.+?)\s+on\s+(?<date>\d{2}\/\d{2}\/\d{4})\s+at\s+(?<time>\d{2}:\d{2}:\d{2})\s+from your account\s+(?:\d[\d*]*?)(?<account>\d{3,4})\b/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /s\.charge of ETB\s*([\d,.]+)/i,
        /service charge of ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT\(15%\)\s+of ETB\s*([\d,.]+)/i,
        /15%\s+VAT of ETB\s*([\d,.]+)/i,
      ]);
      const disasterMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /Disaster Fund \(5%\)\s+of ETB\s*([\d,.]+)/i,
      ]);
      const amountMinor = parseMoneyMinor(match.groups.amount);
      const totalMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /with a total of ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "cbe",
        transactionDirection: "transfer",
        parserTemplateId: "cbe_transfer_masked_v2",
        accountReference: match.groups.account,
        amountMinor,
        feeMinor: computeFeeMinor(amountMinor, [serviceMinor, vatMinor, disasterMinor], totalMinor),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
      };
    },
  },
  {
    id: "cbe_credit_masked_v2",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /account\s+(?:\d[\d*]*?)(?<account>\d{3,4})\s+has been credited with ETB\s*(?<amount>[\d,.]+)\s+from\s+(?<merchant>.+?),\s+on\s+(?<date>\d{2}\/\d{2}\/\d{4})\s+at\s+(?<time>\d{2}:\d{2}:\d{2})(?:\s*(?<meridiem>AM|PM))?/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "cbe",
        transactionDirection: "credit",
        parserTemplateId: "cbe_credit_masked_v2",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(
          match.groups.date,
          match.groups.time,
          match.groups.meridiem,
        ),
        reference:
          rawSmsMessage.smsBody.match(/Ref No\s+(?<reference>[A-Z0-9]+)/i)?.groups
            ?.reference,
      };
    },
  },
  {
    id: "cbe_debit_masked_v2",
    senderKeys: ["cbe"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /account\s+(?:\d[\d*]*?)(?<account>\d{3,4})\s+has been debited with ETB\s*(?<amount>[\d,.]+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service charge of ETB\s*([\d,.]+)/i,
        /s\.charge of ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT\(15%\)\s+of ETB\s*([\d,.]+)/i,
        /15%\s+VAT of ETB\s*([\d,.]+)/i,
      ]);
      const disasterMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /Disaster Fund \(5%\)\s+of ETB\s*([\d,.]+)/i,
      ]);
      const amountMinor = parseMoneyMinor(match.groups.amount);
      const totalMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /with a total of ETB\s*([\d,.]+)/i,
      ]);
      const infoDescription = extractTextValue(rawSmsMessage.smsBody, [
        /Info:\s*([^\.]+)/i,
      ]);

      return {
        financialInstitution: "cbe",
        transactionDirection: "debit",
        parserTemplateId: "cbe_debit_masked_v2",
        accountReference: match.groups.account,
        amountMinor,
        feeMinor: computeFeeMinor(amountMinor, [serviceMinor, vatMinor, disasterMinor], totalMinor),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: infoDescription || "CBE Debit",
      };
    },
  },
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
    id: "dashen_transfer_to_wallet_v1",
    senderKeys: ["dashen", "dashenbank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /ETB\s*(?<amount>[\d,.]+)\s+has been debited from your account\s+(?:\d[\d*]*?)(?<account>\d{3})\s+and credited to the\s+(?<merchant>Telebirr account\s+\+?\d+)\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+at\s+(?<time>\d{2}:\d{2}:\d{2})/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service fee of ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT of ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "dashen",
        transactionDirection: "transfer",
        parserTemplateId: "dashen_transfer_to_wallet_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: computeFeeMinor(parseMoneyMinor(match.groups.amount), [serviceMinor, vatMinor]),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
      };
    },
  },
  {
    id: "dashen_credit_masked_v2",
    senderKeys: ["dashen", "dashenbank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /your account\s+'?(?:\d[\d*]*?)(?<account>\d{3})'?\s+has been credited with ETB\s*(?<amount>[\d,.]+)(?:\s+from\s+(?<merchant>.+?))?\s+on\s+(?<date>\d{2}\/\d{2}\/\d{4})\s+at\s+(?<time>\d{2}:\d{2}:\d{2})\s*(?<meridiem>AM|PM)?/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "dashen",
        transactionDirection: "credit",
        parserTemplateId: "dashen_credit_masked_v2",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant || "Dashen Credit"),
        occurredAt: parseOccurredAtValue(
          match.groups.date,
          match.groups.time,
          match.groups.meridiem,
        ),
      };
    },
  },
  {
    id: "dashen_debit_masked_v2",
    senderKeys: ["dashen", "dashenbank"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /your account\s+'?(?:\d[\d*]*?)(?<account>\d{3})'?\s+(?:is|has been)\s+debited with ETB\s*(?<amount>[\d,.]+)\s+on\s+(?<date>(?:\d{4}-\d{2}-\d{2})|(?:\d{2}\/\d{2}\/\d{4}))(?:\s+at\s+(?<time>\d{2}:\d{2}:\d{2})\s*(?<meridiem>AM|PM)?)?/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service fee of ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /VAT of ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "dashen",
        transactionDirection: "debit",
        parserTemplateId: "dashen_debit_masked_v2",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: computeFeeMinor(parseMoneyMinor(match.groups.amount), [serviceMinor, vatMinor]),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: "Dashen Debit",
        occurredAt: parseOccurredAtValue(
          match.groups.date,
          match.groups.time,
          match.groups.meridiem,
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
    id: "telebirr_bank_credit_v3",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have received\s+ETB\s*(?<amount>[\d,.]+)\s+by transaction number\s+(?<reference>[A-Z0-9]+)\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+(?<time>\d{2}:\d{2}:\d{2})\s+from\s+(?<merchant>.+?)\s+to your telebirr Account\s+(?<account>\d+)/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "telebirr",
        transactionDirection: "credit",
        parserTemplateId: "telebirr_bank_credit_v3",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
          /your current E-Money Account balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
        reference: match.groups.reference,
      };
    },
  },
  {
    id: "telebirr_paid_package_v2",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have paid ETB\s*(?<amount>[\d,.]+)\s+for package\s+(?<merchant>.+?)\s+purchase made for\s+(?<account>\d+)\s+on\s+(?<date>\d{2}\/\d{2}\/\d{4})\s+(?<time>\d{2}:\d{2}:\d{2})/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "telebirr",
        transactionDirection: "debit",
        parserTemplateId: "telebirr_paid_package_v2",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
          /your telebirr account balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
        reference:
          rawSmsMessage.smsBody.match(/transaction number is\s+(?<reference>[A-Z0-9]+)/i)
            ?.groups?.reference,
      };
    },
  },
  {
    id: "telebirr_transfer_bank_v2",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /you have transferred ETB\s*(?<amount>[\d,.]+)\s+successfully from your telebirr account\s*(?<wallet>\d+)?\s+to\s+(?<merchant>.+?)\s+account number\s+(?<account>\d+)\s+on\s+(?<date>\d{2}\/\d{2}\/\d{4})\s+(?<time>\d{2}:\d{2}:\d{2})/i,
      );
      if (!match?.groups) {
        return null;
      }

      const serviceMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /service fee is ETB\s*([\d,.]+)/i,
      ]);
      const vatMinor = searchMoneyMinor(rawSmsMessage.smsBody, [
        /(?:15%\s+)?VAT on the service fee is ETB\s*([\d,.]+)/i,
      ]);

      return {
        financialInstitution: "telebirr",
        transactionDirection: "transfer",
        parserTemplateId: "telebirr_transfer_bank_v2",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: computeFeeMinor(parseMoneyMinor(match.groups.amount), [serviceMinor, vatMinor]),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current balance is ETB\s*([\d,.]+)/i,
          /your current E-Money Account balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
        reference:
          rawSmsMessage.smsBody.match(/bank transaction number is\s+(?<reference>[A-Za-z0-9]+)/i)
            ?.groups?.reference,
      };
    },
  },
  {
    id: "telebirr_atm_withdrawal_v1",
    senderKeys: ["127", "telebirr"],
    matcher: ({ rawSmsMessage }) => {
      const match = rawSmsMessage.smsBody.match(
        /request to withdraw ETB\s*(?<amount>[\d,.]+)\s+from your telebirr account\s+(?<account>\d+)\s+via secret code\s+\d+\s+on\s+(?<date>\d{4}-\d{2}-\d{2})\s+(?<time>\d{2}:\d{2}:\d{2})\s+using\s+(?<merchant>.+?\s+ATM)\s+with transaction number\s+(?<reference>[A-Z0-9]+)\s+is successfully completed/i,
      );
      if (!match?.groups) {
        return null;
      }

      return {
        financialInstitution: "telebirr",
        transactionDirection: "debit",
        parserTemplateId: "telebirr_atm_withdrawal_v1",
        accountReference: match.groups.account,
        amountMinor: parseMoneyMinor(match.groups.amount),
        feeMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /service fee \(including 15% VAT\) is ETB\s*([\d,.]+)/i,
        ]),
        runningBalanceMinor: searchMoneyMinor(rawSmsMessage.smsBody, [
          /your current Account balance is ETB\s*([\d,.]+)/i,
          /your current balance is ETB\s*([\d,.]+)/i,
        ]),
        merchantName: compactText(match.groups.merchant),
        title: compactText(match.groups.merchant),
        occurredAt: parseOccurredAtValue(match.groups.date, match.groups.time),
        reference: match.groups.reference,
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

function runParser(
  rawSmsMessage: RawSmsMessage,
  options?: ParserRuntimeOptions,
): ParserMatchResult {
  const senderKey = normalizeSender(rawSmsMessage.senderLabel);
  const matcherSmsMessage = {
    ...rawSmsMessage,
    smsBody: compactText(rawSmsMessage.smsBody),
  };
  const knownInstitution = KNOWN_SENDER_NAMES[senderKey];
  const runtimeTemplatesToTry = options?.templates
    ? getRuntimeTemplatesToTry(senderKey, options)
    : [];

  for (const template of runtimeTemplatesToTry) {
    const match = buildRuntimeTemplateMatch(matcherSmsMessage, senderKey, template);
    if (!match) {
      continue;
    }

    return {
      status: "matched",
      draft: createDraft(rawSmsMessage, match),
    };
  }

  if (options?.templates) {
    return {
      status: "unmatched",
      failureReason: "no_template_match",
      rawMessageId: rawSmsMessage.messageId,
      senderLabel: rawSmsMessage.senderLabel,
      smsBody: rawSmsMessage.smsBody,
    };
  }

  const candidateTemplates = PARSER_TEMPLATES.filter((template) =>
    template.senderKeys.includes(senderKey),
  );
  for (const template of candidateTemplates) {
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

export function parseSmsMessage(
  rawSmsMessage: RawSmsMessage,
  options?: ParserRuntimeOptions,
): ParserMatchResult {
  return runParser(rawSmsMessage, options);
}

export function parseIncomingSMS(
  rawSmsMessage: RawSmsMessage,
  options?: ParserRuntimeOptions,
): ParserMatchResult {
  return runParser(rawSmsMessage, options);
}
