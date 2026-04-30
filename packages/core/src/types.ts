export const TRANSACTION_CATEGORIES = [
  "food",
  "transport",
  "housing",
  "income",
  "entertainment",
  "misc",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  food: "Food",
  transport: "Transport",
  housing: "Housing",
  income: "Income",
  entertainment: "Entertainment",
  misc: "Misc",
};

export const FINANCIAL_INSTITUTIONS = [
  "cbe",
  "boa",
  "telebirr",
  "cbebirr",
  "dashen",
  "bunna",
  "unknown",
] as const;

export type FinancialInstitution = (typeof FINANCIAL_INSTITUTIONS)[number];

export const FINANCIAL_INSTITUTION_LABELS: Record<FinancialInstitution, string> = {
  cbe: "CBE",
  boa: "BOA",
  telebirr: "Telebirr",
  cbebirr: "CBEBirr",
  dashen: "Dashen Bank",
  bunna: "Bunna Bank",
  unknown: "Unknown",
};

export type TransactionDirection = "credit" | "debit" | "transfer" | "ghost_adjust";
export type AccountChannel = "bank" | "mobile_money" | "cash";
export type UiTone = "primary" | "tertiary" | "secondary" | "surface";

export interface RawSmsMessage {
  messageId: string;
  senderLabel: string;
  smsBody: string;
  receivedAt: string;
}

export interface ParsedTransactionDraft {
  draftId: string;
  rawMessageId: string;
  senderLabel: string;
  rawBody: string;
  financialInstitution: FinancialInstitution;
  transactionDirection: TransactionDirection;
  amountMinor: number;
  feeMinor: number;
  runningBalanceMinor: number;
  currencyCode: "ETB";
  title: string;
  merchantName: string;
  category: TransactionCategory;
  parserTemplateId: string;
  confidence: number;
  occurredAt: string;
  accountReference?: string;
  reference?: string;
  accountChannel: AccountChannel;
  note?: string;
}

export type ParserMatchResult =
  | {
      status: "matched";
      draft: ParsedTransactionDraft;
    }
  | {
      status: "unmatched";
      failureReason: "no_template_match";
      rawMessageId: string;
      senderLabel: string;
      smsBody: string;
    };

export interface ApprovalQueueItem extends ParsedTransactionDraft {
  queueEntryId: string;
  queuedAt: string;
  approvalStatus: "pending_approval";
  note: string;
}

export interface ApprovedTransaction extends ParsedTransactionDraft {
  transactionId: string;
  approvedAt: string;
  approvalStatus: "approved";
  note: string;
}

export interface AccountSummary {
  accountId: string;
  institutionName: string;
  maskedAccountNumber: string;
  balanceMinor: number;
  currencyCode: "ETB";
  channel: AccountChannel;
  iconName: string;
  tone: UiTone;
}

export interface BudgetSummary {
  budgetId: string;
  category: TransactionCategory;
  label: string;
  spentMinor: number;
  limitMinor: number;
  progressPercent: number;
  iconName: string;
  tone: Extract<UiTone, "primary" | "tertiary" | "secondary">;
}

export interface DashboardSnapshot {
  totalBalanceMinor: number;
  pendingApprovalCount: number;
  approvedTransactionCount: number;
  balanceByChannel: Record<AccountChannel, number>;
}
