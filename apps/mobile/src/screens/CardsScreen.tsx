import { useEffect, useMemo, useState } from "react";

import {
  listBuiltInParserTemplateFamilies,
  resolveParserTemplateWorkspace,
  suggestBuiltInParserTemplateFamily,
  upsertParserAccountBinding,
  AccountChannel,
  AccountSummary,
  ApprovedTransaction,
  type ParserTemplateFamilyDefinition,
} from "@omni-sync/core";
import { useTransactionStore } from "@omni-sync/database";
import { MaterialSymbol, type BalanceBreakdownItem } from "@omni-sync/ui";

import { AmountFigure } from "../components/AmountFigure";
import { BottomSheet } from "../components/BottomSheet";
import { ModalWindow } from "../components/ModalWindow";
import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";
import {
  persistParserWorkspacePreferences,
  readParserWorkspacePreferences,
} from "../preferences/parserPreferences";
import {
  PocketWalletCard,
  WalletTemplatePicker,
  deriveWalletVisualSeed,
  type WalletAccentId,
  type WalletCardTemplateId,
  type WalletCardVisual,
} from "../components/accountCardStudio";
import type { CurrencyLabelPreference } from "../preferences/displayPreferences";

interface CardsScreenProps {
  topInstitutionHeadline: string;
  accountCount: number;
  topBalanceDisplay: string;
  visibleChannelCount: number;
  focusSection?: AccountChannel | null;
  balanceBreakdownItems: readonly BalanceBreakdownItem[];
  totalBalanceDisplay: string;
  accountCards: readonly {
    id: string;
    institutionName: string;
    balanceDisplay: string;
    maskedAccountNumber: string;
    icon: string;
    tone: "primary" | "tertiary" | "secondary" | "surface";
  }[];
  accountSummaries?: readonly AccountSummary[];
  approvedTransactions?: readonly ApprovedTransaction[];
  currencyLabel?: CurrencyLabelPreference;
  defaultAccountId?: string | null;
  onOpenCategoryWindow: () => void;
  onEditApprovedTransaction: (transactionId: string) => void;
}

type FlowWindow = "1M" | "3M" | "6M" | "All";
type FlowMetric = "net" | "income" | "expense";
type DetailFilter = "all" | "credit" | "debit";

interface AccountSurfaceAccount extends AccountSummary {
  description?: string;
  sourceKind?: "tracked" | "custom";
  templateId?: WalletCardTemplateId;
  accentId?: WalletAccentId;
  createdAtLabel?: string;
  fullAccountNumber?: string;
}

interface FlowPoint {
  dateLabel: string;
  dateKey: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  balanceMinor: number;
}

interface LineChartPoint {
  x: number;
  y: number;
  value: number;
}

interface LineChartGeometry {
  path: string;
  points: readonly LineChartPoint[];
}

interface DraftAccountForm {
  channel: AccountChannel;
  institutionName: string;
  accountReference: string;
  balance: string;
  description: string;
  parserFamilyKey: string;
  senderAliases: string;
  accountIdentifiers: string;
  identityTextFragments: string;
  templateId: WalletCardTemplateId;
  accentId: WalletAccentId;
}

const CUSTOM_PARSER_FAMILY_KEY = "__custom__";

const channelMeta: Record<
  AccountChannel,
  {
    label: string;
    icon: string;
    accent: string;
    fill: string;
    sectionId: string;
    emptyMessage: string;
  }
> = {
  bank: {
    label: "Banks",
    icon: "account_balance",
    accent: "text-primary",
    fill: "#58c653",
    sectionId: "accounts-section-banks",
    emptyMessage: "No bank accounts are tracked yet.",
  },
  mobile_money: {
    label: "Mobile",
    icon: "phone_iphone",
    accent: "text-[#4fd9cf]",
    fill: "#4fd9cf",
    sectionId: "accounts-section-mobile",
    emptyMessage: "No mobile wallets are tracked yet.",
  },
  cash: {
    label: "Cash",
    icon: "payments",
    accent: "text-[#5c61ff]",
    fill: "#5c61ff",
    sectionId: "accounts-section-cash",
    emptyMessage: "No cash stores are tracked yet.",
  },
};

const flowWindows: readonly { id: FlowWindow; label: string; days: number | null }[] = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 90 },
  { id: "6M", label: "6M", days: 180 },
  { id: "All", label: "All", days: null },
];

function formatAmountMinor(amountMinor: number, currencyLabel: CurrencyLabelPreference) {
  return `${(amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyLabel}`;
}

function formatCompactMinor(amountMinor: number, currencyLabel: CurrencyLabelPreference) {
  return `${(amountMinor / 100).toLocaleString("en-US", {
    notation: "compact",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} ${currencyLabel}`;
}

function getAccountDigits(label: string) {
  return label.replace(/\D/g, "").slice(-4);
}

function getSignedMinor(transaction: ApprovedTransaction) {
  return transaction.transactionDirection === "credit"
    ? transaction.amountMinor
    : -1 * (transaction.amountMinor + transaction.feeMinor);
}

function matchesAccount(
  account: AccountSurfaceAccount,
  transaction: ApprovedTransaction,
) {
  if (account.channel !== transaction.accountChannel) {
    return false;
  }

  if (account.channel === "cash") {
    return transaction.accountChannel === "cash";
  }

  const digits = getAccountDigits(account.maskedAccountNumber);
  return digits.length > 0 && digits === transaction.accountReference?.slice(-4);
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function getDraftForm(channel: AccountChannel): DraftAccountForm {
  const seed = deriveWalletVisualSeed(`draft-${channel}`, channel);

  return {
    channel,
    institutionName: "",
    accountReference: "",
    balance: "",
    description: "",
    parserFamilyKey: "",
    senderAliases: "",
    accountIdentifiers: "",
    identityTextFragments: "",
    templateId: seed.templateId,
    accentId: seed.accentId,
  };
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
}

function buildAccountIdentifierFallback(accountReference: string): string[] {
  const trimmed = accountReference.trim();
  if (!trimmed) {
    return [];
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 3) {
    return [digits.slice(-4)];
  }

  return [trimmed];
}

function buildManagedAccountSurface(
  account: AccountSummary & {
    note?: string;
    createdAt?: string;
  },
  sourceKind: AccountSurfaceAccount["sourceKind"],
): AccountSurfaceAccount {
  return {
    ...account,
    description: account.note?.trim() ? account.note : undefined,
    createdAtLabel: sourceKind === "custom" ? "Created manually" : "Seeded",
    sourceKind,
  };
}

function findParserFamilyByKey(
  families: readonly ParserTemplateFamilyDefinition[],
  institutionKey: string,
): ParserTemplateFamilyDefinition | null {
  return (
    families.find(
      (family) =>
        family.institutionKey.trim().toLowerCase() === institutionKey.trim().toLowerCase(),
    ) ?? null
  );
}

function buildFlowSeries(
  account: AccountSurfaceAccount | null,
  approvedTransactions: readonly ApprovedTransaction[],
  anchorDate: Date,
  windowId: FlowWindow,
) {
  if (!account) {
    return [] as FlowPoint[];
  }

  const totalDays =
    flowWindows.find((option) => option.id === windowId)?.days ?? 30;
  const startDate = totalDays === null ? subtractDays(anchorDate, 180) : subtractDays(anchorDate, totalDays);
  const matching = approvedTransactions
    .filter((transaction) => matchesAccount(account, transaction))
    .filter((transaction) => {
      const occurredAt = new Date(transaction.occurredAt);
      return occurredAt >= startDate && occurredAt <= anchorDate;
    })
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );

  const buckets = new Map<string, FlowPoint>();

  for (let offset = 0; offset <= 6; offset += 1) {
    const pointDate =
      totalDays === null
        ? subtractDays(anchorDate, 180 - offset * 30)
        : subtractDays(anchorDate, Math.round((totalDays / 6) * (6 - offset)));
    const key = pointDate.toISOString().slice(0, 10);
    buckets.set(key, {
      dateLabel: pointDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      dateKey: key,
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      balanceMinor: account.balanceMinor,
    });
  }

  matching.forEach((transaction) => {
    const occurredAt = new Date(transaction.occurredAt);
    const closestKey = Array.from(buckets.keys()).reduce((bestKey, candidateKey) => {
      const bestDistance = Math.abs(
        new Date(bestKey).getTime() - occurredAt.getTime(),
      );
      const candidateDistance = Math.abs(
        new Date(candidateKey).getTime() - occurredAt.getTime(),
      );

      return candidateDistance < bestDistance ? candidateKey : bestKey;
    });
    const bucket = buckets.get(closestKey);

    if (!bucket) {
      return;
    }

    if (transaction.transactionDirection === "credit") {
      bucket.incomeMinor += transaction.amountMinor;
    } else {
      bucket.expenseMinor += transaction.amountMinor + transaction.feeMinor;
    }

    bucket.netMinor += getSignedMinor(transaction);
  });

  const points = Array.from(buckets.values()).sort((left, right) =>
    left.dateKey.localeCompare(right.dateKey),
  );

  let runningBalance = account.balanceMinor;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    points[index].balanceMinor = Math.max(0, runningBalance);
    runningBalance -= points[index].netMinor;
  }

  return points;
}

function buildLinePath(values: readonly number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = (width / Math.max(1, values.length - 1)) * index;
      const y = height - ((value - min) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildLineChartGeometry(
  values: readonly number[],
  width: number,
  height: number,
): LineChartGeometry {
  if (values.length === 0) {
    return { path: "", points: [] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (width / Math.max(1, values.length - 1)) * index;
    const y = height - ((value - min) / spread) * height;

    return { x, y, value };
  });

  return {
    path: points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" "),
    points,
  };
}

function buildArcPath(startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) {
  const center = 100;
  const startOuterX = center + outerRadius * Math.cos(startAngle);
  const startOuterY = center + outerRadius * Math.sin(startAngle);
  const endOuterX = center + outerRadius * Math.cos(endAngle);
  const endOuterY = center + outerRadius * Math.sin(endAngle);
  const startInnerX = center + innerRadius * Math.cos(endAngle);
  const startInnerY = center + innerRadius * Math.sin(endAngle);
  const endInnerX = center + innerRadius * Math.cos(startAngle);
  const endInnerY = center + innerRadius * Math.sin(startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${startOuterX} ${startOuterY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuterX} ${endOuterY}`,
    `L ${startInnerX} ${startInnerY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endInnerX} ${endInnerY}`,
    "Z",
  ].join(" ");
}

export function CardsScreen({
  topInstitutionHeadline,
  accountCount,
  topBalanceDisplay,
  visibleChannelCount,
  focusSection = null,
  balanceBreakdownItems,
  totalBalanceDisplay,
  accountCards,
  accountSummaries = [],
  approvedTransactions = [],
  currencyLabel = "ETB",
  defaultAccountId = null,
  onOpenCategoryWindow,
  onEditApprovedTransaction,
}: CardsScreenProps) {
  const customAccounts = useTransactionStore((state) => state.customAccounts);
  const createCustomAccount = useTransactionStore((state) => state.createCustomAccount);
  const [selectedChannel, setSelectedChannel] = useState<AccountChannel>("bank");
  const [selectedAccountByChannel, setSelectedAccountByChannel] = useState<
    Partial<Record<AccountChannel, string>>
  >({});
  const [selectedFlowWindow, setSelectedFlowWindow] = useState<FlowWindow>("1M");
  const [selectedMetric, setSelectedMetric] = useState<FlowMetric>("net");
  const [isFlowFiltersOpen, setIsFlowFiltersOpen] = useState(false);
  const [activePointIndex, setActivePointIndex] = useState(0);
  const [isPointPinned, setIsPointPinned] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [detailFilter, setDetailFilter] = useState<DetailFilter>("all");
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [draftForm, setDraftForm] = useState(() => getDraftForm("bank"));
  const [showAdvancedParserSetup, setShowAdvancedParserSetup] = useState(false);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Record<string, boolean>>({});
  const parserFamilies = useMemo(() => listBuiltInParserTemplateFamilies(), []);
  const suggestedParserFamily = useMemo(
    () => suggestBuiltInParserTemplateFamily(draftForm.institutionName),
    [draftForm.institutionName],
  );
  const selectedParserFamily = useMemo(() => {
    if (draftForm.parserFamilyKey === CUSTOM_PARSER_FAMILY_KEY) {
      return null;
    }

    return (
      findParserFamilyByKey(parserFamilies, draftForm.parserFamilyKey) ??
      suggestedParserFamily
    );
  }, [draftForm.parserFamilyKey, parserFamilies, suggestedParserFamily]);
  const anchorDate = useMemo(() => {
    const latest = approvedTransactions
      .slice()
      .sort(
        (left, right) =>
          new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime(),
      )[0]?.approvedAt;

    return latest ? new Date(latest) : new Date("2026-05-01T00:00:00.000Z");
  }, [approvedTransactions]);

  const allAccounts = useMemo<AccountSurfaceAccount[]>(
    () => [
      ...accountSummaries.map((account) => buildManagedAccountSurface(account, "tracked")),
      ...customAccounts.map((account) => buildManagedAccountSurface(account, "custom")),
    ],
    [accountSummaries, customAccounts],
  );

  const groupedAccounts = useMemo(
    () => ({
      bank: allAccounts.filter((account) => account.channel === "bank"),
      mobile_money: allAccounts.filter((account) => account.channel === "mobile_money"),
      cash: allAccounts.filter((account) => account.channel === "cash"),
    }),
    [allAccounts],
  );

  useEffect(() => {
    if (!focusSection) {
      return;
    }

    setSelectedChannel(focusSection);
    document.getElementById(channelMeta[focusSection].sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusSection]);

  useEffect(() => {
    if (groupedAccounts[selectedChannel].length > 0) {
      return;
    }

    if (groupedAccounts.bank.length > 0) {
      setSelectedChannel("bank");
    } else if (groupedAccounts.mobile_money.length > 0) {
      setSelectedChannel("mobile_money");
    } else if (groupedAccounts.cash.length > 0) {
      setSelectedChannel("cash");
    }
  }, [groupedAccounts, selectedChannel]);

  useEffect(() => {
    if (
      groupedAccounts[selectedChannel].length > 0 &&
      !selectedAccountByChannel[selectedChannel]
    ) {
      setSelectedAccountByChannel((current) => ({
        ...current,
        [selectedChannel]:
          defaultAccountId &&
          groupedAccounts[selectedChannel].some(
            (account) => account.accountId === defaultAccountId,
          )
            ? defaultAccountId
            : groupedAccounts[selectedChannel][0]?.accountId,
      }));
    }
  }, [defaultAccountId, groupedAccounts, selectedAccountByChannel, selectedChannel]);

  useEffect(() => {
    setHiddenAccountIds((current) => {
      const next = { ...current };

      allAccounts.forEach((account) => {
        if (next[account.accountId] === undefined) {
          next[account.accountId] = true;
        }
      });

      Object.keys(next).forEach((accountId) => {
        if (!allAccounts.some((account) => account.accountId === accountId)) {
          delete next[accountId];
        }
      });

      return next;
    });
  }, [allAccounts]);

  const selectedAccount =
    groupedAccounts[selectedChannel].find(
      (account) => account.accountId === selectedAccountByChannel[selectedChannel],
    ) ??
    groupedAccounts[selectedChannel][0] ??
    null;

  const flowSeries = useMemo(
    () => buildFlowSeries(selectedAccount, approvedTransactions, anchorDate, selectedFlowWindow),
    [anchorDate, approvedTransactions, selectedAccount, selectedFlowWindow],
  );

  const flowValues = flowSeries.map((point) =>
    selectedMetric === "income"
      ? point.incomeMinor
      : selectedMetric === "expense"
        ? point.expenseMinor
        : point.netMinor,
  );
  const activePoint = flowSeries[Math.min(activePointIndex, Math.max(flowSeries.length - 1, 0))];
  const flowGeometry = useMemo(
    () => buildLineChartGeometry(flowValues, 320, 150),
    [flowValues],
  );
  const linePath = flowGeometry.path;
  const activeChartPoint =
    flowGeometry.points[Math.min(activePointIndex, Math.max(flowGeometry.points.length - 1, 0))];

  const totalBalanceMinor = useMemo(
    () => allAccounts.reduce((sum, account) => sum + account.balanceMinor, 0),
    [allAccounts],
  );
  const derivedVisibleChannelCount = useMemo(
    () =>
      (["bank", "mobile_money", "cash"] as const).filter(
        (channel) => groupedAccounts[channel].length > 0,
      ).length,
    [groupedAccounts],
  );
  const monthlyNetMinor = useMemo(
    () =>
      approvedTransactions
        .filter((transaction) => {
          const occurredAt = new Date(transaction.occurredAt);
          return occurredAt >= subtractDays(anchorDate, 30);
        })
        .reduce((sum, transaction) => sum + getSignedMinor(transaction), 0),
    [anchorDate, approvedTransactions],
  );
  const hasTransactionHistory = approvedTransactions.length > 0;

  const distribution = useMemo(() => {
    const entries = (["bank", "mobile_money", "cash"] as const).map((channel) => {
      const balanceMinor = allAccounts
        .filter((account) => account.channel === channel)
        .reduce((sum, account) => sum + account.balanceMinor, 0);

      return {
        channel,
        label: channelMeta[channel].label,
        balanceMinor,
        share:
          totalBalanceMinor > 0 ? Math.round((balanceMinor / totalBalanceMinor) * 100) : 0,
      };
    });

    let cursor = -Math.PI / 2;
    return entries.map((entry) => {
      const arc = totalBalanceMinor > 0 ? (entry.balanceMinor / totalBalanceMinor) * Math.PI * 2 : 0;
      const startAngle = cursor;
      const endAngle = cursor + Math.max(arc, 0.18);
      cursor = endAngle + 0.12;

      return {
        ...entry,
        path: buildArcPath(startAngle, endAngle, 88, 68),
        offsetX: Math.cos((startAngle + endAngle) / 2) * 10,
        offsetY: Math.sin((startAngle + endAngle) / 2) * 10,
      };
    });
  }, [allAccounts, totalBalanceMinor]);

  const accountStats = useMemo(() => {
    const map = new Map<
      string,
      {
        transactionCount: number;
        incomeMinor: number;
        expenseMinor: number;
        monthlyNetMinor: number;
      }
    >();

    allAccounts.forEach((account) => {
      const matching = approvedTransactions.filter((transaction) =>
        matchesAccount(account, transaction),
      );
      const recent = matching.filter(
        (transaction) => new Date(transaction.occurredAt) >= subtractDays(anchorDate, 30),
      );

      map.set(account.accountId, {
        transactionCount: matching.length,
        incomeMinor: matching
          .filter((transaction) => transaction.transactionDirection === "credit")
          .reduce((sum, transaction) => sum + transaction.amountMinor, 0),
        expenseMinor: matching
          .filter((transaction) => transaction.transactionDirection !== "credit")
          .reduce((sum, transaction) => sum + transaction.amountMinor + transaction.feeMinor, 0),
        monthlyNetMinor: recent.reduce((sum, transaction) => sum + getSignedMinor(transaction), 0),
      });
    });

    return map;
  }, [allAccounts, anchorDate, approvedTransactions]);

  const detailAccount =
    allAccounts.find((account) => account.accountId === detailAccountId) ?? null;
  const detailTransactions = useMemo(() => {
    if (!detailAccount) {
      return [];
    }

    return approvedTransactions
      .filter((transaction) => matchesAccount(detailAccount, transaction))
      .filter((transaction) => {
        if (detailFilter === "credit") {
          return transaction.transactionDirection === "credit";
        }
        if (detailFilter === "debit") {
          return transaction.transactionDirection !== "credit";
        }
        return true;
      })
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
      );
  }, [approvedTransactions, detailAccount, detailFilter]);
  const detailSeries = useMemo(
    () => buildFlowSeries(detailAccount, approvedTransactions, anchorDate, "All"),
    [anchorDate, approvedTransactions, detailAccount],
  );
  const detailPath = buildLinePath(
    detailSeries.map((point) => point.balanceMinor),
    320,
    132,
  );

  function isAccountSensitiveHidden(accountId: string) {
    return hiddenAccountIds[accountId] ?? true;
  }

  function setAccountSensitiveVisibility(accountId: string, nextValue: boolean) {
    setHiddenAccountIds((current) => ({
      ...current,
      [accountId]: nextValue,
    }));
  }

  function resolveFlowPointIndex(clientX: number, rect: DOMRect) {
    const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
    return Math.max(
      0,
      Math.min(
        flowSeries.length - 1,
        Math.round(ratio * Math.max(flowSeries.length - 1, 0)),
      ),
    );
  }

  function openAddAccountSheet(channel: AccountChannel) {
    setDraftForm(getDraftForm(channel));
    setShowAdvancedParserSetup(false);
    setIsAddSheetOpen(true);
  }

  function createAccount() {
    const balanceMinor = Math.round(Number(draftForm.balance || "0") * 100);
    if (!draftForm.institutionName.trim() || balanceMinor <= 0) {
      return;
    }

    const reference = draftForm.accountReference.trim();
    const createdAccount = createCustomAccount({
      institutionName: draftForm.institutionName.trim(),
      accountReference: reference || undefined,
      balanceMinor,
      channel: draftForm.channel,
      note: draftForm.description.trim(),
    });

    if (draftForm.parserFamilyKey !== CUSTOM_PARSER_FAMILY_KEY && selectedParserFamily) {
      const senderAliases = parseTextList(draftForm.senderAliases);
      const accountIdentifiers = parseTextList(draftForm.accountIdentifiers);
      const identityTextFragments = parseTextList(draftForm.identityTextFragments);
      const snapshot =
        readParserWorkspacePreferences() ?? {
          version: 3 as const,
          templateWorkspace: {
            version: 3 as const,
            builtInOverrides: [],
            accountBindings: [],
            customTemplates: [],
          },
          selectedTemplateId: "",
          senderLabel: selectedParserFamily.defaultSenderAliases[0] ?? selectedParserFamily.institutionKey,
          strictSchemaParsing: true,
          preserveRawSms: true,
          autoReconciliation: true,
          verboseLogging: false,
        };
      const nextWorkspace = upsertParserAccountBinding(snapshot.templateWorkspace, {
        accountId: createdAccount.accountId,
        accountLabel: createdAccount.institutionName,
        accountChannel: createdAccount.channel,
        financialInstitution: selectedParserFamily.financialInstitution,
        institutionKey: selectedParserFamily.institutionKey,
        status: "active",
        userProfile: {
          senderAliases:
            senderAliases.length > 0
              ? senderAliases
              : selectedParserFamily.defaultSenderAliases,
          accountIdentifiers:
            accountIdentifiers.length > 0
              ? accountIdentifiers
              : buildAccountIdentifierFallback(reference),
          identityTextFragments,
        },
      });
      const resolvedTemplates = resolveParserTemplateWorkspace(nextWorkspace);
      const selectedTemplateId =
        resolvedTemplates.find(
          (template) => template.linkedAccountId === createdAccount.accountId,
        )?.id ??
        snapshot.selectedTemplateId ??
        resolvedTemplates[0]?.id ??
        "";

      persistParserWorkspacePreferences({
        ...snapshot,
        version: 3,
        templateWorkspace: nextWorkspace,
        selectedTemplateId,
        senderLabel:
          senderAliases[0] ??
          selectedParserFamily.defaultSenderAliases[0] ??
          snapshot.senderLabel,
      });
    }

    setDraftForm(getDraftForm(draftForm.channel));
    setShowAdvancedParserSetup(false);
    setIsAddSheetOpen(false);
  }

  return (
    <MotionPage includeStyles className="space-y-6">
      <section className="space-y-6">
      <MotionStagger
        className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        step={55}
        variant="panel"
      >
        <section className="rounded-[28px] border border-outline-variant/18 bg-surface-container-low p-5 shadow-[0_8px_24px_rgba(46,50,48,0.07)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Distribution
              </p>
              <h2 className="mt-1 font-headline text-2xl font-semibold text-on-surface">
                Account allocation
              </h2>
            </div>
            <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
              {derivedVisibleChannelCount} channels
            </span>
          </div>

          <p className="mt-2 text-sm text-on-surface-variant">
            Tap a share chip to filter the pocket cards.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <svg className="mx-auto h-[188px] w-[188px]" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                fill="none"
                r="78"
                stroke="rgba(74,78,74,0.08)"
                strokeWidth="18"
              />
              {distribution.map((segment) => (
                <path
                  d={segment.path}
                  fill={channelMeta[segment.channel].fill}
                  key={segment.channel}
                  opacity={selectedChannel === segment.channel ? 1 : 0.84}
                  onClick={() => setSelectedChannel(segment.channel)}
                  style={{
                    cursor: "pointer",
                    filter:
                      selectedChannel === segment.channel
                        ? "drop-shadow(0 10px 16px rgba(46,50,48,0.16))"
                        : "none",
                    transform:
                      selectedChannel === segment.channel
                        ? "translate(0px, 0px) scale(1.012)"
                        : "translate(0px, 0px) scale(1)",
                    transformBox: "fill-box",
                    transformOrigin: "100px 100px",
                    transition: "transform 220ms ease, filter 220ms ease, opacity 220ms ease",
                  }}
                  stroke={
                    selectedChannel === segment.channel
                      ? "rgba(255,255,255,0.75)"
                      : "rgba(255,255,255,0.28)"
                  }
                  strokeWidth={selectedChannel === segment.channel ? "2.5" : "1.25"}
                />
              ))}
              <circle cx="100" cy="100" fill="#ffffff" r="48" />
              <circle
                cx="100"
                cy="100"
                fill="none"
                r="48"
                stroke="rgba(74,78,74,0.05)"
                strokeWidth="1.5"
              />
              <text
                fill="#4a4e4a"
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                x="100"
                y="88"
              >
                Tracked total
              </text>
              <text
                fill="#1f2321"
                fontFamily="Literata, serif"
                fontSize="20"
                fontWeight="700"
                textAnchor="middle"
                x="100"
                y="110"
              >
                {(totalBalanceMinor / 100).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </text>
              <text
                fill="#64a44a"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                x="100"
                y="128"
              >
                {currencyLabel}
              </text>
            </svg>

            <div className="grid w-full gap-2">
              {distribution.map((segment) => (
                <button
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border px-3.5 py-2.5 text-left transition active:scale-[0.985] ${
                    selectedChannel === segment.channel
                      ? "border-primary/26 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,242,234,0.96))] text-on-surface shadow-[0_10px_18px_rgba(46,50,48,0.08)]"
                      : "border-outline-variant/16 bg-surface-container-lowest text-on-surface-variant"
                  }`}
                  key={segment.channel}
                  onClick={() => setSelectedChannel(segment.channel)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: channelMeta[segment.channel].fill }}
                        />
                        <span className="truncate text-sm font-semibold text-on-surface">
                          {segment.label} share
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                        {formatCompactMinor(segment.balanceMinor, currencyLabel)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="block h-full rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: channelMeta[segment.channel].fill,
                          width:
                            segment.share <= 0
                              ? "0%"
                              : `${Math.min(100, segment.share)}%`,
                        }}
                      >
                        <span
                          className="block h-full w-full rounded-full bg-white/20"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-on-surface">
                      {segment.share}%
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">
                      total
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant/18 bg-surface-container-low p-5 shadow-[0_8px_24px_rgba(46,50,48,0.07)]">
          {hasTransactionHistory ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    Flow line
                  </p>
                  <h2 className="mt-1 font-headline text-2xl font-semibold text-on-surface">
                    Cash flow
                  </h2>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Graph-first view with advanced filtering kept behind one control.
                  </p>
                </div>
                <button
                  aria-label="Open advanced cash flow filters"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/18 bg-surface text-primary transition active:scale-[0.96]"
                  onClick={() => setIsFlowFiltersOpen(true)}
                  type="button"
                >
                  <MaterialSymbol filled name="filter_alt" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
                  {selectedMetric === "net"
                    ? "Net flow"
                    : selectedMetric === "income"
                      ? "Income"
                      : "Expense"}
                </span>
                <span className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-on-surface-variant">
                  {selectedFlowWindow}
                </span>
                <span className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-on-surface-variant">
                  {selectedAccount?.institutionName ?? "No account selected"}
                </span>
              </div>

              <div
                className="mt-4 rounded-[26px] border border-outline-variant/16 bg-surface p-4"
                data-testid="accounts-line-chart-surface"
                onMouseLeave={() => {
                  if (isPointPinned) {
                    return;
                  }
                  setActivePointIndex(0);
                }}
                onMouseMove={(event) => {
                  if (isPointPinned) {
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setActivePointIndex(resolveFlowPointIndex(event.clientX, rect));
                }}
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setActivePointIndex(resolveFlowPointIndex(event.clientX, rect));
                  setIsPointPinned(true);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      Selected account
                    </p>
                    <p className="mt-1 text-sm font-semibold text-on-surface">
                      {selectedAccount?.institutionName ?? "No account selected"}
                    </p>
                  </div>
                  {isPointPinned ? (
                    <button
                      className="rounded-full bg-surface-container px-3 py-2 text-xs font-semibold text-primary transition active:scale-[0.97]"
                      onClick={() => setIsPointPinned(false)}
                      type="button"
                    >
                      Release
                    </button>
                  ) : null}
                </div>

                <svg className="mt-5 h-[180px] w-full" viewBox="0 0 320 160">
                  <defs>
                    <linearGradient id="accounts-flow-gradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#7780ff" />
                      <stop offset="55%" stopColor="#44c8ff" />
                      <stop offset="100%" stopColor="#58c653" />
                    </linearGradient>
                  </defs>
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#accounts-flow-gradient)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                  />
                  {activePoint && flowSeries.length > 0 ? (
                    <>
                      <line
                        stroke="rgba(90, 164, 255, 0.24)"
                        strokeDasharray="4 6"
                        x1={activeChartPoint?.x ?? 0}
                        x2={activeChartPoint?.x ?? 0}
                        y1="0"
                        y2="150"
                      />
                      <circle
                        cx={activeChartPoint?.x ?? 0}
                        cy={activeChartPoint?.y ?? 0}
                        fill="#ffffff"
                        r="7"
                        stroke="#4fa7ff"
                        strokeWidth="3"
                      />
                      <circle
                        cx={activeChartPoint?.x ?? 0}
                        cy={activeChartPoint?.y ?? 0}
                        fill="none"
                        r={isPointPinned ? "13" : "11"}
                        stroke="rgba(79, 167, 255, 0.24)"
                        strokeWidth="6"
                      />
                    </>
                  ) : null}
                </svg>

                {activePoint ? (
                  <div className="mt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface">
                        {activePoint.dateLabel}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {isPointPinned ? "Pinned" : "Touch a point"}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[18px] bg-surface-container-low px-3 py-2.5 text-on-surface">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
                          Net
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {activePoint.netMinor >= 0 ? "+" : "-"}
                          {formatCompactMinor(Math.abs(activePoint.netMinor), currencyLabel)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-surface-container-low px-3 py-2.5 text-on-surface">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
                          Income
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatCompactMinor(activePoint.incomeMinor, currencyLabel)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-surface-container-low px-3 py-2.5 text-on-surface">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
                          Expense
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatCompactMinor(activePoint.expenseMinor, currencyLabel)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-surface-container-low px-3 py-2.5 text-on-surface">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
                          Balance
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatCompactMinor(activePoint.balanceMinor, currencyLabel)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  First account
                </p>
                <h2 className="mt-1 font-headline text-2xl font-semibold text-on-surface">
                  Build your account list first
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Add your first account before charts and transaction trends
                  appear here.
                </p>
              </div>
              <div className="rounded-[24px] border border-dashed border-outline-variant/20 bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-on-surface">
                  Add your first account
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Start with the basics, then return once real activity has been
                  reviewed.
                </p>
              </div>
            </div>
          )}
        </section>
      </MotionStagger>

      <MotionPanel
        className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low px-4 py-3 shadow-[0_8px_24px_rgba(46,50,48,0.06)]"
        delay={90}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Category tools
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Open the reusable category window from Accounts without leaving this workspace.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-primary transition active:scale-[0.97]"
            onClick={onOpenCategoryWindow}
            type="button"
          >
            <MaterialSymbol filled name="category" />
            Add Category
          </button>
        </div>
      </MotionPanel>

      <div className="space-y-5">
        {(["bank", "mobile_money", "cash"] as const).map((channel) => {
          const accounts = groupedAccounts[channel];
          const meta = channelMeta[channel];

          return (
            <MotionPanel
              className="rounded-[28px] border border-outline-variant/18 bg-surface-container-low p-5 shadow-[0_8px_24px_rgba(46,50,48,0.07)]"
              delay={130 + (channel === "bank" ? 0 : channel === "mobile_money" ? 45 : 90)}
              key={channel}
            >
            <section id={meta.sectionId}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MaterialSymbol className={meta.accent} filled name={meta.icon} />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      {meta.label}
                    </p>
                  </div>
                  <h2 className="mt-1 font-headline text-2xl font-semibold text-on-surface">
                    {accounts.length} accounts
                  </h2>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-primary transition active:scale-[0.97]"
                  onClick={() => openAddAccountSheet(channel)}
                  type="button"
                >
                  <MaterialSymbol filled name="add" />
                  Add
                </button>
              </div>

              {accounts.length > 0 ? (
                <MotionStagger className="grid gap-4 lg:grid-cols-2" step={34}>
                  {accounts.map((account) => {
                    const seed = deriveWalletVisualSeed(account.accountId, account.channel);
                    const stats = accountStats.get(account.accountId);
                    const isSelected = selectedAccountByChannel[channel] === account.accountId;
                    const isSensitiveHidden = isAccountSensitiveHidden(account.accountId);
                    const visual: WalletCardVisual = {
                      accountId: account.accountId,
                      institutionName: account.institutionName,
                      maskedAccountNumber: account.maskedAccountNumber,
                      fullAccountNumber: account.fullAccountNumber,
                      balanceMinor: account.balanceMinor,
                      iconName:
                        accountCards.find((item) => item.id === account.accountId)?.icon ??
                        account.iconName,
                      templateId: account.templateId ?? seed.templateId,
                      accentId: account.accentId ?? seed.accentId,
                      helperLabel:
                        account.channel === "bank"
                          ? "Bank balance"
                          : account.channel === "mobile_money"
                            ? "Mobile wallet"
                            : "Cash reserve",
                      tag:
                        account.sourceKind === "custom"
                          ? "Custom account"
                          : "Tracked account",
                      currencyLabel,
                      isDefault: account.accountId === defaultAccountId,
                    };

                    return (
                      <div
                        className={`rounded-[30px] p-2 text-left transition duration-200 active:scale-[0.99] ${
                          isSelected
                            ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(247,242,234,0.82))] shadow-[0_18px_30px_rgba(46,50,48,0.1)]"
                            : "bg-transparent"
                        }`}
                        key={account.accountId}
                        onClick={() => {
                          setSelectedChannel(channel);
                          setSelectedAccountByChannel((current) => ({
                            ...current,
                            [channel]: account.accountId,
                          }));
                          setDetailAccountId(account.accountId);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedChannel(channel);
                            setSelectedAccountByChannel((current) => ({
                              ...current,
                              [channel]: account.accountId,
                            }));
                            setDetailAccountId(account.accountId);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <PocketWalletCard
                          className={isSelected ? "ring-1 ring-white/35" : undefined}
                          isSensitiveHidden={isSensitiveHidden}
                          onSensitiveVisibilityChange={(nextValue) =>
                            setAccountSensitiveVisibility(account.accountId, nextValue)
                          }
                          visual={visual}
                        />
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div className="rounded-[20px] bg-surface px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                              Created
                            </p>
                            <p className="mt-1 text-sm font-semibold text-on-surface">
                              {account.createdAtLabel ?? "Seeded"}
                            </p>
                          </div>
                          <div className="rounded-[20px] bg-surface px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                              Live now
                            </p>
                            <p
                              className={`mt-1 text-sm font-semibold text-on-surface transition ${
                                isSensitiveHidden ? "blur-[4px] opacity-90" : ""
                              }`}
                            >
                              {isSensitiveHidden
                                ? "••••"
                                : formatCompactMinor(account.balanceMinor, currencyLabel)}
                            </p>
                          </div>
                          <div className="rounded-[20px] bg-surface px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                              Net / month
                            </p>
                            <p
                              className={`mt-1 text-sm font-semibold transition ${
                                (stats?.monthlyNetMinor ?? 0) >= 0
                                  ? "text-primary"
                                  : "text-[#8b3330]"
                              } ${isSensitiveHidden ? "blur-[4px] opacity-90" : ""}`}
                            >
                              {isSensitiveHidden
                                ? "••••"
                                : `${(stats?.monthlyNetMinor ?? 0) >= 0 ? "+" : "-"}${formatCompactMinor(
                                    Math.abs(stats?.monthlyNetMinor ?? 0),
                                    currencyLabel,
                                  )}`}
                            </p>
                          </div>
                        </div>
                        {account.description ? (
                          <p className="mt-3 text-sm text-on-surface-variant">
                            {account.description}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </MotionStagger>
              ) : (
                <div className="rounded-2xl border border-dashed border-outline-variant/24 bg-surface px-4 py-5 text-sm text-on-surface-variant">
                  {meta.emptyMessage}
                </div>
              )}
            </section>
            </MotionPanel>
          );
        })}
      </div>

      <ModalWindow
        isOpen={isFlowFiltersOpen}
        onClose={() => setIsFlowFiltersOpen(false)}
        subtitle="Channel, account, range, and detail filters."
        title="Advanced flow filters"
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Channel
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface"
                onChange={(event) =>
                  setSelectedChannel(event.target.value as AccountChannel)
                }
                value={selectedChannel}
              >
                <option value="bank">Bank</option>
                <option value="mobile_money">Mobile</option>
                <option value="cash">Cash</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Account
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface"
                onChange={(event) => {
                  const nextAccountId = event.target.value;
                  setSelectedAccountByChannel((current) => ({
                    ...current,
                    [selectedChannel]: nextAccountId,
                  }));
                  setDetailAccountId(nextAccountId);
                }}
                value={selectedAccountByChannel[selectedChannel] ?? ""}
              >
                {groupedAccounts[selectedChannel].map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.institutionName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Metric
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface"
                onChange={(event) => setSelectedMetric(event.target.value as FlowMetric)}
                value={selectedMetric}
              >
                <option value="net">Net flow</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Range
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface"
                onChange={(event) => setSelectedFlowWindow(event.target.value as FlowWindow)}
                value={selectedFlowWindow}
              >
                {flowWindows.map((windowOption) => (
                  <option key={windowOption.id} value={windowOption.id}>
                    {windowOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Detail list
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface"
                onChange={(event) => setDetailFilter(event.target.value as DetailFilter)}
                value={detailFilter}
              >
                <option value="all">All</option>
                <option value="credit">Credits only</option>
                <option value="debit">Debits only</option>
              </select>
            </label>
          </div>

          <div className="rounded-[24px] border border-dashed border-outline-variant/22 bg-background px-4 py-4">
            <p className="text-sm font-semibold text-on-surface">Session only</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              These filters apply to the current session only.
            </p>
          </div>
        </div>
      </ModalWindow>

      <BottomSheet
        className="max-w-4xl"
        isOpen={detailAccount !== null}
        maxHeightClassName="max-h-[78vh]"
        onClose={() => setDetailAccountId(null)}
        subtitle={
          detailAccount
            ? `${detailAccount.maskedAccountNumber} / ${detailTransactions.length} transactions`
            : undefined
        }
        title={detailAccount?.institutionName ?? "Account detail"}
      >
        {detailAccount ? (
          <div className="space-y-5">
            <div className="rounded-[26px] bg-[#111317] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/68">Balance history</p>
                  <AmountFigure
                    amountMinor={detailAccount.balanceMinor}
                    className="mt-2 gap-2"
                    currencyLabel={currencyLabel}
                    labelClassName="text-white/52"
                    valueClassName="text-white"
                  />
                </div>
                <div className="flex gap-2">
                  {(["all", "credit", "debit"] as const).map((option) => (
                    <button
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                        detailFilter === option
                          ? "bg-white text-[#111317]"
                          : "bg-white/10 text-white/76"
                      }`}
                      key={option}
                      onClick={() => setDetailFilter(option)}
                      type="button"
                    >
                      {option === "all"
                        ? "All"
                        : option === "credit"
                          ? "Credits"
                          : "Debits"}
                    </button>
                  ))}
                </div>
              </div>

              <svg className="mt-6 h-[150px] w-full" viewBox="0 0 320 140">
                <path
                  d={detailPath}
                  fill="none"
                  stroke="url(#accounts-flow-gradient)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
              </svg>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
                  Transactions
                </p>
                <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                  {detailTransactions.length}
                </p>
              </article>
              <article className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
                  Income
                </p>
                <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                  {formatCompactMinor(
                    accountStats.get(detailAccount.accountId)?.incomeMinor ?? 0,
                    currencyLabel,
                  )}
                </p>
              </article>
              <article className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
                  Expense
                </p>
                <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                  {formatCompactMinor(
                    accountStats.get(detailAccount.accountId)?.expenseMinor ?? 0,
                    currencyLabel,
                  )}
                </p>
              </article>
            </div>

            <div className="space-y-3">
              {detailTransactions.length > 0 ? (
                detailTransactions.map((transaction) => (
                  <article
                    className="rounded-2xl border border-outline-variant/18 bg-surface px-4 py-4"
                    key={transaction.transactionId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <button
                          aria-label={`Edit ${transaction.title}`}
                          className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary transition active:scale-[0.96]"
                          onClick={() => onEditApprovedTransaction(transaction.transactionId)}
                          type="button"
                        >
                          <MaterialSymbol filled name="edit" />
                        </button>
                        <div>
                          <p className="font-semibold text-on-surface">{transaction.title}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {new Date(transaction.occurredAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <p className={`font-semibold ${transaction.transactionDirection === "credit" ? "text-primary" : "text-on-surface"}`}>
                        {transaction.transactionDirection === "credit" ? "+" : "-"}
                        {formatCompactMinor(
                          transaction.transactionDirection === "credit"
                            ? transaction.amountMinor
                            : transaction.amountMinor + transaction.feeMinor,
                          currencyLabel,
                        )}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-outline-variant/24 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  No transactions match this filter for the selected account.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        isOpen={isAddSheetOpen}
        maxHeightClassName="max-h-[82vh]"
        onClose={() => setIsAddSheetOpen(false)}
        subtitle="Start with the basics. SMS matching can be refined later."
        title="Create account"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Card appearance
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Visual only. Does not affect parsing.
            </p>
            <div className="mt-4">
              <WalletTemplatePicker
                onSelectAccent={(accentId) =>
                  setDraftForm((current) => ({ ...current, accentId }))
                }
                onSelectTemplate={(templateId) =>
                  setDraftForm((current) => ({ ...current, templateId }))
                }
                selectedAccentId={draftForm.accentId}
                selectedTemplateId={draftForm.templateId}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Account type
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["bank", "mobile_money", "cash"] as const).map((channel) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                    draftForm.channel === channel
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant"
                  }`}
                  key={channel}
                  onClick={() =>
                    setDraftForm((current) => ({
                      ...current,
                      channel,
                    }))
                  }
                  type="button"
                >
                  {channel === "mobile_money"
                    ? "Mobile"
                    : channel.charAt(0).toUpperCase() + channel.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Institution
              </span>
              <input
                className="w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                name="institutionName"
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    institutionName: event.target.value,
                  }))
                }
                placeholder="Dashen Bank"
                type="text"
                value={draftForm.institutionName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Balance
              </span>
              <input
                className="w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                name="balance"
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    balance: event.target.value,
                  }))
                }
                placeholder="0"
                type="number"
                value={draftForm.balance}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Account number
              </span>
              <input
                className="w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                name="accountReference"
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    accountReference: event.target.value,
                  }))
                }
                placeholder="100023914920"
                type="text"
                value={draftForm.accountReference}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Note
              </span>
              <textarea
                className="w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                name="description"
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional note"
                rows={3}
                value={draftForm.description}
              />
            </label>
          </div>

          <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  SMS matching (optional)
                </p>
                <h3 className="mt-1 text-base font-semibold text-on-surface">
                  Use the built-in suggestion
                </h3>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
                {selectedParserFamily
                  ? `${selectedParserFamily.templateCount} rules ready`
                  : "Optional"}
              </span>
            </div>

            <p className="mt-2 text-sm text-on-surface-variant">
              We will suggest SMS matching from the institution name. You can
              create the account now and refine SMS matching later.
            </p>

            <div className="mt-4 rounded-[20px] bg-background px-4 py-4">
              <p className="text-sm font-semibold text-on-surface">
                {draftForm.parserFamilyKey === CUSTOM_PARSER_FAMILY_KEY
                  ? "Custom parser path"
                  : selectedParserFamily
                    ? `${selectedParserFamily.institutionLabel} built-in parser`
                    : "No family selected yet"}
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                {draftForm.parserFamilyKey === CUSTOM_PARSER_FAMILY_KEY
                  ? "Create the account now, then build the custom parser later in Parsing."
                  : selectedParserFamily
                    ? `Keeps the built-in ${selectedParserFamily.institutionLabel} rules and applies your account values.`
                    : "Type the institution name to get a family suggestion."}
              </p>
            </div>
            <button
              className="mt-4 rounded-full border border-outline-variant/25 bg-surface px-4 py-2 text-sm font-semibold text-on-surface"
              onClick={() => setShowAdvancedParserSetup((current) => !current)}
              type="button"
            >
              {showAdvancedParserSetup
                ? "Hide advanced parser setup"
                : "Advanced parser setup"}
            </button>

            {showAdvancedParserSetup ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {parserFamilies.map((family) => {
                    const isSelected =
                      draftForm.parserFamilyKey === family.institutionKey ||
                      (!draftForm.parserFamilyKey &&
                        selectedParserFamily?.institutionKey === family.institutionKey);

                    return (
                      <button
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                          isSelected
                            ? "bg-primary text-on-primary"
                            : "bg-surface text-on-surface-variant"
                        }`}
                        key={family.institutionKey}
                        onClick={() =>
                          setDraftForm((current) => ({
                            ...current,
                            parserFamilyKey: family.institutionKey,
                            senderAliases:
                              current.senderAliases.trim().length > 0
                                ? current.senderAliases
                                : family.defaultSenderAliases.join(", "),
                            accountIdentifiers:
                              current.accountIdentifiers.trim().length > 0
                                ? current.accountIdentifiers
                                : buildAccountIdentifierFallback(
                                    current.accountReference,
                                  ).join(", "),
                          }))
                        }
                        type="button"
                      >
                        {family.institutionLabel}
                      </button>
                    );
                  })}
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                      draftForm.parserFamilyKey === CUSTOM_PARSER_FAMILY_KEY
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant"
                    }`}
                    onClick={() =>
                      setDraftForm((current) => ({
                        ...current,
                        parserFamilyKey: CUSTOM_PARSER_FAMILY_KEY,
                      }))
                    }
                    type="button"
                  >
                    Custom build
                  </button>
                </div>

                {draftForm.parserFamilyKey !== CUSTOM_PARSER_FAMILY_KEY ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-on-surface">
                        Sender aliases
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                        name="senderAliases"
                        onChange={(event) =>
                          setDraftForm((current) => ({
                            ...current,
                            senderAliases: event.target.value,
                          }))
                        }
                        placeholder={
                          selectedParserFamily?.defaultSenderAliases.join(", ") ??
                          "CBE, DashenBank, 127"
                        }
                        rows={3}
                        value={draftForm.senderAliases}
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Match the sender label shown in SMS.
                      </p>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-on-surface">
                        Account identifiers
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                        name="accountIdentifiers"
                        onChange={(event) =>
                          setDraftForm((current) => ({
                            ...current,
                            accountIdentifiers: event.target.value,
                          }))
                        }
                        placeholder={
                          buildAccountIdentifierFallback(draftForm.accountReference).join(", ") ||
                          "4920, 0172"
                        }
                        rows={3}
                        value={draftForm.accountIdentifiers}
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Use the masked digits or account text shown in SMS.
                      </p>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-on-surface">
                        Identity text fragments
                      </span>
                      <textarea
                        className="min-h-24 w-full rounded-[20px] border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                        name="identityTextFragments"
                        onChange={(event) =>
                          setDraftForm((current) => ({
                            ...current,
                            identityTextFragments: event.target.value,
                          }))
                        }
                        placeholder="salary, personal wallet, payroll"
                        rows={3}
                        value={draftForm.identityTextFragments}
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Optional phrases to separate this account from similar SMS.
                      </p>
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant"
              onClick={() => setIsAddSheetOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
              onClick={createAccount}
              type="button"
            >
              Create account
            </button>
          </div>
        </div>
      </BottomSheet>
      </section>
    </MotionPage>
  );
}
