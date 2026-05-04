export type MaterialSymbolName = string;

export type FinanceAccentTone = "primary" | "tertiary" | "secondary";

export type AccountSurfaceTone = FinanceAccentTone | "surface";

export interface TopAppBarProfile {
  avatarUrl?: string;
  avatarAlt: string;
  avatarFallbackLabel: string;
}

export interface TopAppBarAction {
  icon: MaterialSymbolName;
  label: string;
  onPress?: () => void;
  variant?: "icon" | "pill";
}

export interface BalanceBreakdownItem {
  id: string;
  label: string;
  amountDisplay: string;
  icon: MaterialSymbolName;
  tone: FinanceAccentTone;
}

export interface AccountSummaryCardData {
  id: string;
  institutionName: string;
  balanceDisplay: string;
  maskedAccountNumber: string;
  icon: MaterialSymbolName;
  tone: AccountSurfaceTone;
}

export interface BudgetCategorySnapshot {
  id: string;
  label: string;
  amountDisplay: string;
  progressPercent: number;
  icon: MaterialSymbolName;
  tone: FinanceAccentTone;
}

export interface InboxTransactionPreview {
  id: string;
  merchantName: string;
  categoryName: string;
  categoryIcon: MaterialSymbolName;
  transactionIcon: MaterialSymbolName;
  tone: FinanceAccentTone;
  amountDisplay?: string;
  sourceSenderLabel?: string;
  sourceAccountLabel?: string;
  sourceInstitutionLabel?: string;
  sourceConfidenceLabel?: string;
}

export interface BottomNavigationItem {
  id: string;
  label: string;
  icon: MaterialSymbolName;
  isActive: boolean;
  kind?: "tab" | "action";
  onPress?: () => void;
}

export interface TransactionCategoryOption {
  value: string;
  label: string;
}
