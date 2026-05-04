import type {
  AccountChannel,
  AccountSummary,
  AccountVisibilityOverride,
  CreateCustomAccountInput,
  CustomAccountRecord,
  ManagedAccount,
  UiTone,
  UpdateCustomAccountInput,
} from "@omni-sync/core";

interface ManagedAccountStateShape {
  accountSummaries: readonly AccountSummary[];
  customAccounts: readonly CustomAccountRecord[];
  accountVisibilityOverrides: readonly AccountVisibilityOverride[];
}

const customAccountChannelMeta: Record<
  AccountChannel,
  {
    iconName: string;
    tone: UiTone;
    fallbackMaskedNumber: string;
  }
> = {
  bank: {
    iconName: "account_balance",
    tone: "primary",
    fallbackMaskedNumber: "Custom account",
  },
  mobile_money: {
    iconName: "account_balance_wallet",
    tone: "secondary",
    fallbackMaskedNumber: "Custom wallet",
  },
  cash: {
    iconName: "payments",
    tone: "surface",
    fallbackMaskedNumber: "Pocket cash",
  },
};

function requireInstitutionName(institutionName: string): string {
  const trimmed = institutionName.trim();

  if (trimmed.length === 0) {
    throw new Error("Custom account institution name is required.");
  }

  return trimmed;
}

function normalizeBalanceMinor(balanceMinor: number): number {
  if (!Number.isFinite(balanceMinor)) {
    throw new Error("Custom account balance must be a finite number.");
  }

  return Math.max(0, Math.round(balanceMinor));
}

function normalizeAccountReference(
  accountReference?: string | null,
): string | undefined {
  const trimmed = accountReference?.trim();
  return trimmed ? trimmed : undefined;
}

function formatMaskedAccountNumber(
  accountReference: string | undefined,
  channel: AccountChannel,
): string {
  if (accountReference) {
    return `**** ${accountReference.slice(-4)}`;
  }

  return customAccountChannelMeta[channel].fallbackMaskedNumber;
}

function buildCustomAccountId(
  channel: AccountChannel,
  institutionName: string,
  createdAt: string,
): string {
  const institutionKey =
    institutionName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "account";
  const timestampKey = createdAt.replace(/\D/g, "").slice(0, 14) || "manual";

  return `custom-${channel}-${institutionKey}-${timestampKey}`;
}

export function createCustomAccountRecord(
  input: CreateCustomAccountInput,
  createdAt = new Date().toISOString(),
): CustomAccountRecord {
  const institutionName = requireInstitutionName(input.institutionName);
  const accountReference = normalizeAccountReference(input.accountReference);
  const channel = input.channel;
  const { iconName, tone } = customAccountChannelMeta[channel];

  return {
    accountId: buildCustomAccountId(channel, institutionName, createdAt),
    institutionName,
    maskedAccountNumber: formatMaskedAccountNumber(accountReference, channel),
    fullAccountNumber: accountReference,
    balanceMinor: normalizeBalanceMinor(input.balanceMinor),
    currencyCode: "ETB",
    channel,
    iconName,
    tone,
    note: input.note?.trim() ?? "",
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateCustomAccountRecord(
  account: CustomAccountRecord,
  updates: UpdateCustomAccountInput,
  updatedAt = new Date().toISOString(),
): CustomAccountRecord {
  const institutionName =
    updates.institutionName === undefined
      ? account.institutionName
      : requireInstitutionName(updates.institutionName);
  const channel = updates.channel ?? account.channel;
  const accountReference =
    updates.accountReference === undefined
      ? account.fullAccountNumber
      : normalizeAccountReference(updates.accountReference);
  const { iconName, tone } = customAccountChannelMeta[channel];

  return {
    ...account,
    institutionName,
    maskedAccountNumber: formatMaskedAccountNumber(accountReference, channel),
    fullAccountNumber: accountReference,
    balanceMinor:
      updates.balanceMinor === undefined
        ? account.balanceMinor
        : normalizeBalanceMinor(updates.balanceMinor),
    channel,
    iconName,
    tone,
    note: updates.note === undefined ? account.note : updates.note.trim(),
    updatedAt,
  };
}

export function upsertAccountVisibilityOverride(
  overrides: readonly AccountVisibilityOverride[],
  accountId: string,
  isHidden: boolean,
  updatedAt = new Date().toISOString(),
): AccountVisibilityOverride[] {
  const nextOverride: AccountVisibilityOverride = {
    accountId,
    isHidden,
    updatedAt,
  };
  const existingIndex = overrides.findIndex(
    (override) => override.accountId === accountId,
  );

  if (existingIndex === -1) {
    return [...overrides, nextOverride];
  }

  return overrides.map((override, index) =>
    index === existingIndex ? nextOverride : override,
  );
}

export function selectManagedAccounts(
  state: ManagedAccountStateShape,
): ManagedAccount[] {
  const visibilityByAccountId = new Map(
    state.accountVisibilityOverrides.map((override) => [
      override.accountId,
      override.isHidden,
    ]),
  );

  return [
    ...state.accountSummaries.map<ManagedAccount>((account) => ({
      ...account,
      source: "derived",
      isHidden: visibilityByAccountId.get(account.accountId) ?? false,
    })),
    ...state.customAccounts.map<ManagedAccount>((account) => ({
      ...account,
      source: "custom",
      isHidden: visibilityByAccountId.get(account.accountId) ?? false,
    })),
  ];
}

export function selectVisibleManagedAccounts(
  state: ManagedAccountStateShape,
): ManagedAccount[] {
  return selectManagedAccounts(state).filter((account) => !account.isHidden);
}
