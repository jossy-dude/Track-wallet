import type {
  AccountSummary,
  ApprovalQueueItem,
  ApprovedTransaction,
  DashboardSnapshot,
  FinancialInstitution,
  ParsedTransactionDraft,
  BudgetSummary,
  UiTone,
} from "@omni-sync/core";
import { FINANCIAL_INSTITUTION_LABELS } from "@omni-sync/core";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  buildBudgetSummaries,
  demoAccountSummaries,
  demoApprovalQueue,
  demoApprovedTransactions,
} from "./mockData";

export interface TransactionStoreState {
  hasInitialized: boolean;
  approvalQueue: ApprovalQueueItem[];
  approvedTransactions: ApprovedTransaction[];
  accountSummaries: AccountSummary[];
  budgetSummaries: BudgetSummary[];
  activeQueueEntryId: string | null;
  seedDemoData: () => void;
  queueParsedTransaction: (
    draft: ParsedTransactionDraft,
    queuedAt?: string,
  ) => ApprovalQueueItem;
  openTransactionEditor: (queueEntryId: string) => void;
  closeTransactionEditor: () => void;
  editApprovalQueueItem: (
    queueEntryId: string,
    updates: Partial<Pick<ApprovalQueueItem, "title" | "category" | "note">>,
  ) => void;
  approveQueueItem: (
    queueEntryId: string,
    approvedAt?: string,
  ) => ApprovedTransaction | null;
  rejectQueueItem: (queueEntryId: string) => void;
  clearAllData: () => void;
}

type TransactionStoreApi = StoreApi<TransactionStoreState>;

function cloneApprovalQueue(): ApprovalQueueItem[] {
  return demoApprovalQueue.map((item) => ({ ...item }));
}

function cloneApprovedTransactions(): ApprovedTransaction[] {
  return demoApprovedTransactions.map((item) => ({ ...item }));
}

function cloneAccountSummaries(): AccountSummary[] {
  return demoAccountSummaries.map((item) => ({ ...item }));
}

function createFallbackStorage() {
  const memory = new Map<string, string>();

  return {
    getItem: (name: string) => memory.get(name) ?? null,
    setItem: (name: string, value: string) => {
      memory.set(name, value);
    },
    removeItem: (name: string) => {
      memory.delete(name);
    },
  };
}

function getPersistStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return createFallbackStorage();
}

function createInitialState() {
  return {
    hasInitialized: false,
    approvalQueue: [] as ApprovalQueueItem[],
    approvedTransactions: [] as ApprovedTransaction[],
    accountSummaries: [] as AccountSummary[],
    budgetSummaries: [] as BudgetSummary[],
    activeQueueEntryId: null as string | null,
  };
}

const accountToneByInstitution: Record<FinancialInstitution, UiTone> = {
  cbe: "primary",
  boa: "surface",
  telebirr: "secondary",
  cbebirr: "secondary",
  dashen: "tertiary",
  bunna: "surface",
  unknown: "surface",
};

const accountIconByInstitution: Record<FinancialInstitution, string> = {
  cbe: "account_balance",
  boa: "shield",
  telebirr: "phone_iphone",
  cbebirr: "payments",
  dashen: "diamond",
  bunna: "account_balance_wallet",
  unknown: "payments",
};

function formatMaskedAccountNumber(
  accountReference: string | undefined,
  accountChannel: ParsedTransactionDraft["accountChannel"],
): string {
  if (!accountReference) {
    return accountChannel === "cash" ? "Pocket cash" : "Unknown account";
  }

  return `**** ${accountReference.slice(-4)}`;
}

function buildAccountSummaryFromDraft(
  draft: ParsedTransactionDraft,
): AccountSummary | null {
  if (draft.runningBalanceMinor <= 0) {
    return null;
  }

  const accountReference = draft.accountReference?.trim();
  const accountId = `acct-${draft.financialInstitution}-${
    accountReference || draft.accountChannel
  }`;

  return {
    accountId,
    institutionName: FINANCIAL_INSTITUTION_LABELS[draft.financialInstitution],
    maskedAccountNumber: formatMaskedAccountNumber(
      accountReference,
      draft.accountChannel,
    ),
    balanceMinor: draft.runningBalanceMinor,
    currencyCode: "ETB",
    channel: draft.accountChannel,
    iconName:
      draft.accountChannel === "cash"
        ? "payments"
        : accountIconByInstitution[draft.financialInstitution],
    tone:
      draft.accountChannel === "cash"
        ? "surface"
        : accountToneByInstitution[draft.financialInstitution],
  };
}

function syncAccountSummariesWithDraft(
  accountSummaries: readonly AccountSummary[],
  draft: ParsedTransactionDraft,
): AccountSummary[] {
  const nextSummary = buildAccountSummaryFromDraft(draft);
  if (!nextSummary) {
    return [...accountSummaries];
  }

  const existingIndex = accountSummaries.findIndex(
    (accountSummary) => accountSummary.accountId === nextSummary.accountId,
  );

  if (existingIndex === -1) {
    return [nextSummary, ...accountSummaries];
  }

  return accountSummaries.map((accountSummary, index) =>
    index === existingIndex ? nextSummary : accountSummary,
  );
}

export function buildDashboardSnapshot(
  state: Pick<
    TransactionStoreState,
    "accountSummaries" | "approvalQueue" | "approvedTransactions"
  >,
): DashboardSnapshot {
  const balanceByChannel: DashboardSnapshot["balanceByChannel"] = {
    bank: 0,
    mobile_money: 0,
    cash: 0,
  };

  for (const accountSummary of state.accountSummaries) {
    balanceByChannel[accountSummary.channel] += accountSummary.balanceMinor;
  }

  return {
    totalBalanceMinor: Object.values(balanceByChannel).reduce(
      (total, value) => total + value,
      0,
    ),
    pendingApprovalCount: state.approvalQueue.length,
    approvedTransactionCount: state.approvedTransactions.length,
    balanceByChannel,
  };
}

export function createTransactionStore(): TransactionStoreApi {
  return createStore<TransactionStoreState>()(
    persist(
      (set, get) => ({
        ...createInitialState(),
        seedDemoData: () => {
          const approvedTransactions = cloneApprovedTransactions();

          set({
            hasInitialized: true,
            approvalQueue: cloneApprovalQueue(),
            approvedTransactions,
            accountSummaries: cloneAccountSummaries(),
            budgetSummaries: buildBudgetSummaries(approvedTransactions),
            activeQueueEntryId: null,
          });
        },
        queueParsedTransaction: (draft, queuedAt = new Date().toISOString()) => {
          const queuedDraft: ApprovalQueueItem = {
            ...draft,
            queueEntryId: `queue-${draft.draftId}-${queuedAt}`,
            queuedAt,
            approvalStatus: "pending_approval",
            note: draft.note ?? "",
          };

          set((state) => ({
            hasInitialized: true,
            approvalQueue: [queuedDraft, ...state.approvalQueue],
            accountSummaries: syncAccountSummariesWithDraft(
              state.accountSummaries,
              draft,
            ),
          }));

          return queuedDraft;
        },
        openTransactionEditor: (queueEntryId) => {
          set({ activeQueueEntryId: queueEntryId });
        },
        closeTransactionEditor: () => {
          set({ activeQueueEntryId: null });
        },
        editApprovalQueueItem: (queueEntryId, updates) => {
          set((state) => ({
            approvalQueue: state.approvalQueue.map((queueItem) =>
              queueItem.queueEntryId === queueEntryId
                ? { ...queueItem, ...updates }
                : queueItem,
            ),
          }));
        },
        approveQueueItem: (queueEntryId, approvedAt = new Date().toISOString()) => {
          const state = get();
          const queueItem = state.approvalQueue.find(
            (candidate) => candidate.queueEntryId === queueEntryId,
          );

          if (!queueItem) {
            return null;
          }

          const approvedTransaction: ApprovedTransaction = {
            ...queueItem,
            transactionId: `tx-${queueItem.queueEntryId}`,
            approvedAt,
            approvalStatus: "approved",
          };

          const approvedTransactions = [
            approvedTransaction,
            ...state.approvedTransactions,
          ];

          set({
            approvalQueue: state.approvalQueue.filter(
              (candidate) => candidate.queueEntryId !== queueEntryId,
            ),
            approvedTransactions,
            budgetSummaries: buildBudgetSummaries(approvedTransactions),
            activeQueueEntryId: null,
          });

          return approvedTransaction;
        },
        rejectQueueItem: (queueEntryId) => {
          set((state) => ({
            approvalQueue: state.approvalQueue.filter(
              (queueItem) => queueItem.queueEntryId !== queueEntryId,
            ),
            activeQueueEntryId:
              state.activeQueueEntryId === queueEntryId
                ? null
                : state.activeQueueEntryId,
          }));
        },
        clearAllData: () => {
          set({
            hasInitialized: true,
            approvalQueue: [],
            approvedTransactions: [],
            accountSummaries: [],
            budgetSummaries: [],
            activeQueueEntryId: null,
          });
        },
      }),
      {
        name: "omni-sync-storage",
        storage: createJSONStorage(getPersistStorage),
        partialize: (state) => ({
          hasInitialized: state.hasInitialized,
          approvalQueue: state.approvalQueue,
          approvedTransactions: state.approvedTransactions,
          accountSummaries: state.accountSummaries,
          budgetSummaries: state.budgetSummaries,
          activeQueueEntryId: state.activeQueueEntryId,
        }),
      },
    ),
  );
}

const transactionStore = createTransactionStore();

export function useTransactionStore<T>(
  selector: (state: TransactionStoreState) => T,
): T {
  return useStore(transactionStore, selector);
}

export { transactionStore };
