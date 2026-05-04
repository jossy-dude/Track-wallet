import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  buildParserRuntimeOptionsFromWorkspace,
  cloneDefaultParserTemplates,
  FINANCIAL_INSTITUTION_LABELS,
  inspectParserTemplate,
  migrateResolvedTemplatesToWorkspace,
  resolveParserTemplateWorkspace,
  TRANSACTION_CATEGORY_LABELS,
  type FinancialInstitution,
  type NearbySyncDevice,
  type ParserTemplateDateMode,
  type ParserTemplateDefinition,
  type ParserTemplateInspectionBinding,
  type ParserTemplateStatus,
  type TransactionDirection,
} from "@omni-sync/core";
import { useTransactionStore } from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPage,
  MotionPanel,
  SettingsMotionStyles,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import { useParser } from "../hooks/useParser";
import {
  clearAccountProfilePreferences,
  getDefaultAccountProfilePreferences,
  persistAccountProfilePreferences,
  readAccountProfilePreferences,
} from "../preferences/accountPreferences";
import {
  persistBottomNavStylePreference,
  persistCurrencyLabelPreference,
  persistDefaultAccountIdPreference,
  persistAccountOrderPreference,
  readBottomNavStylePreference,
  readCurrencyLabelPreference,
  readDefaultAccountIdPreference,
  type BottomNavStylePreference,
  type CurrencyLabelPreference,
} from "../preferences/displayPreferences";
import {
  clearParserWorkspacePreferences,
  persistParserWorkspacePreferences,
  readParserWorkspacePreferences,
} from "../preferences/parserPreferences";
import {
  readSecurityPreferences,
} from "../preferences/securityPreferences";
import { readDemoModeEnabled } from "../preferences/setupPreferences";
import {
  helpCategoryCards,
  helpFeaturedFaqs,
  type HelpCategoryCard,
} from "./settingsHelpContent";
import { DataStoragePage } from "./DataStoragePage";
import { ParsingWorkspacePage } from "./ParsingWorkspacePage";
import { SmsCaptureRoutingPage } from "./SmsCaptureRoutingPage";
import { type SettingsPageId } from "./settingsHubContent";

type AppTabId = "home" | "inbox" | "ledger" | "accounts";

interface SettingsDetailScreenProps {
  pageId: SettingsPageId;
  onOpenPage?: (pageId: SettingsPageId) => void;
  onOpenTab?: (tabId: AppTabId) => void;
  orderedAccountIds?: readonly string[];
  demoModeEnabled?: boolean;
  onRequestEnableDemoMode?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const parserSenderOptions = [
  {
    value: "CBE",
    label: "CBE",
    financialInstitution: "cbe" as const,
    icon: "account_balance",
  },
  {
    value: "DashenBank",
    label: "Dashen Bank",
    financialInstitution: "dashen" as const,
    icon: "account_balance",
  },
  {
    value: "127",
    label: "Telebirr",
    financialInstitution: "telebirr" as const,
    icon: "account_balance_wallet",
  },
  {
    value: "BOA",
    label: "BOA",
    financialInstitution: "boa" as const,
    icon: "account_balance",
  },
  {
    value: "CBEBirr",
    label: "CBEBirr",
    financialInstitution: "cbebirr" as const,
    icon: "account_balance_wallet",
  },
  {
    value: "BunnaBank",
    label: "Bunna Bank",
    financialInstitution: "bunna" as const,
    icon: "account_balance",
  },
] as const;

const parserSandboxFallbackSamples: Record<string, string> = {
  CBE: "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
  DashenBank:
    "Dashen Alert: ETB 1,250.00 debited from account 7788 on 2026-04-28 at FUEL STATION. Available balance ETB 19,880.00",
  127: "Telebirr: ETB 320.00 paid to COFFEE SHOP from wallet 0172 on 2026-04-28. Current balance ETB 1,880.00",
  BOA: "BOA ALERT: ETB 980.00 credited to account 2104 on 2026-04-27 from CLIENT PAYMENT. Bal ETB 15,420.00",
  CBEBirr:
    "You have withdrawn 500.00Br from CBE ATM. charge 5.00Br tax 0.75Br. balance is 1,244.25Br",
  BunnaBank:
    "Bunna alert: ETB 215.00 debited from account 1633 on 2026-04-26 at TAXI FARE. Bal ETB 5,615.00",
};

function matchesParserSenderFamily(sourceValue: string, senderLabel: string) {
  const normalizedSender = senderLabel.trim().toLowerCase();
  const normalizedSource = sourceValue.trim().toLowerCase();

  if (normalizedSender.includes(normalizedSource)) {
    return true;
  }

  if (normalizedSource === "dashenbank") {
    return normalizedSender.includes("dashen");
  }

  if (normalizedSource === "127") {
    return normalizedSender.includes("telebirr") || normalizedSender === "127";
  }

  return false;
}

function getParserSenderOption(senderValue: string) {
  return (
    parserSenderOptions.find((option) => option.value === senderValue) ??
    parserSenderOptions[0]
  );
}

function getInstitutionKeyForTemplate(template: ParserTemplateDefinition): string {
  return template.senderAliases[0] ?? template.institutionKey;
}

function buildParserTemplateNote(template: ParserTemplateDefinition): string {
  const mappedFields = [
    template.amountKey,
    template.merchantKey,
    template.balanceKey,
    template.feeKey,
    template.vatKey,
    template.accountKey,
    template.referenceKey,
  ]
    .filter(Boolean)
    .join(", ");

  return mappedFields
    ? `${template.direction} route with ${mappedFields}`
    : `${template.direction} route`;
}

function buildParserSourceFromBindings(
  bindings: ParserTemplateInspectionBinding[],
  template: ParserTemplateDefinition,
): string {
  const bindingLines = bindings.map((binding, index) => {
    const lineNumber = 11 + index;
    const propertyName = binding.field === "extra_fee" ? "extraFee" : binding.field;
    const valueExpression = binding.captureKey
      ? `match.groups.${binding.captureKey} ?? null`
      : "null";
    return `${lineNumber}     ${propertyName}: ${valueExpression},`;
  });

  return [
    "1  function parseSMS(message) {",
    `2    const regex = /${template.regex}/i;`,
    "3    const match = message.match(regex);",
    "4",
    "5    if (!match?.groups) {",
    "6      return null;",
    "7    }",
    "8",
    "9    return {",
    `10     direction: "${template.direction}",`,
    ...bindingLines,
    `${11 + bindingLines.length}   };`,
    `${12 + bindingLines.length} }`,
  ].join("\n");
}

function createTemplateBuilderSeed(
  sender = "CBE",
): {
  sender: string;
  name: string;
  regex: string;
  direction: TransactionDirection;
  amountKey: string;
  merchantKey: string;
  balanceKey: string;
  feeKey: string;
  vatKey: string;
  accountKey: string;
  referenceKey: string;
  dateKey: string;
  timeKey: string;
  meridiemKey: string;
  dateMode: ParserTemplateDateMode;
} {
  return {
    sender,
    name: "",
    regex: "",
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    feeKey: "fee",
    vatKey: "vat",
    accountKey: "account",
    referenceKey: "reference",
    dateKey: "date",
    timeKey: "time",
    meridiemKey: "meridiem",
    dateMode: "message_date",
  };
}

const appearanceAccents = [
  { id: "forest", color: "bg-primary", selected: true },
  { id: "amber", color: "bg-tertiary", selected: false },
  { id: "rust", color: "bg-[#b85a4a]", selected: false },
  { id: "sage", color: "bg-[#8aa390]", selected: false },
  { id: "ocean", color: "bg-[#5a7c8c]", selected: false },
] as const;

const bottomNavStyleOptions: Array<{
  id: BottomNavStylePreference;
  label: string;
  description: string;
}> = [
  {
    id: "detached",
    label: "Detached dock",
    description: "Split rails with the add action floating between them.",
  },
  {
    id: "connected",
    label: "Connected dock",
    description: "One curved dock with a center notch around the add action.",
  },
];

function formatCurrencyMinor(amountMinor: number): string {
  return `ETB ${currencyFormatter.format(amountMinor / 100)}`;
}

function formatShortDate(value: string): string {
  return shortDateFormatter.format(new Date(value));
}

function formatShortDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not yet";
  }

  return shortDateTimeFormatter.format(new Date(value));
}

function formatPlatformLabel(platform: NearbySyncDevice["platform"]): string {
  if (platform === "desktop") {
    return "Desktop";
  }

  if (platform === "tablet") {
    return "Tablet";
  }

  return "Mobile";
}

function materialForDevice(device: { platform: NearbySyncDevice["platform"] }) {
  if (device.platform === "desktop") {
    return "computer";
  }

  if (device.platform === "tablet") {
    return "tablet_mac";
  }

  return "phone_iphone";
}

function sanitizeAlphaSyncCopy(value: string) {
  return value
    .replace(/local preview route/gi, "saved route")
    .replace(/trusted preview route/gi, "saved route")
    .replace(/trusted route/gi, "saved route")
    .replace(/desktop route/gi, "saved device route");
}

function SwitchButton({
  checked,
  onToggle,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-checked={checked}
      className={`relative h-7 w-14 rounded-full transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.96] ${
        checked
          ? "bg-primary"
          : "border border-outline-variant bg-surface-variant"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onToggle();
        }
      }}
      role="switch"
      type="button"
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${
          checked ? "right-1" : "left-1"
        }`}
      />
    </button>
  );
}

type StatusTone = "success" | "warning" | "error";
type ActionState = "idle" | "working" | "done";

function StatusToast({
  message,
  tone,
}: {
  message: string;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-primary/20 bg-primary-container/70 text-on-primary-fixed"
      : tone === "warning"
        ? "border-tertiary/20 bg-tertiary-container/40 text-on-tertiary-container"
        : "border-error/20 bg-error-container/80 text-on-error-container";

  const icon =
    tone === "success"
      ? "check_circle"
      : tone === "warning"
        ? "error"
        : "warning";

  return (
    <MotionPanel className="sticky top-2 z-30 flex justify-start" variant="toast">
      <div
        className={`flex max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_24px_rgba(46,50,48,0.08)] ${toneClass}`}
      >
        <MaterialSymbol className="mt-0.5 text-[18px]" filled name={icon} />
        <p className="text-sm leading-6">{message}</p>
      </div>
    </MotionPanel>
  );
}

function ActionStatusButton({
  actionState,
  idleLabel,
  workingLabel,
  doneLabel,
  className,
  onClick,
}: {
  actionState: ActionState;
  idleLabel: string;
  workingLabel: string;
  doneLabel: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`${className} ${pressableClass}`}
      onClick={onClick}
      type="button"
    >
      {actionState === "done" ? (
        <>
          <MaterialSymbol filled name="check" />
          {doneLabel}
        </>
      ) : actionState === "working" ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {workingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function OverlayPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#2e3230]/45 p-4 backdrop-blur-sm">
      <MotionPanel className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-outline-variant/30 bg-background p-6 shadow-[0_16px_48px_rgba(46,50,48,0.24)]">
        {title || subtitle ? (
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {subtitle}
              </p>
            </div>
            <button
              aria-label="Close panel"
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high ${pressableClass}`}
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol name="close" />
            </button>
          </div>
        ) : (
          <div className="mb-3 flex justify-end">
            <button
              aria-label="Close panel"
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high ${pressableClass}`}
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol name="close" />
            </button>
          </div>
        )}
        {children}
      </MotionPanel>
    </div>
  );
}

function ManageAccountPage() {
  const defaultPreferences = getDefaultAccountProfilePreferences();
  const [displayName, setDisplayName] = useState(() =>
    readAccountProfilePreferences().displayName,
  );
  const [profileNote, setProfileNote] = useState(() =>
    readAccountProfilePreferences().profileNote,
  );
  const [hideBalances, setHideBalances] = useState(() =>
    readAccountProfilePreferences().hideBalances,
  );
  const [blurNotifications, setBlurNotifications] = useState(() =>
    readAccountProfilePreferences().blurNotifications,
  );
  const [requireExportReview, setRequireExportReview] = useState(() =>
    readAccountProfilePreferences().requireExportReview,
  );
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  function showAccountStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2200);
  }

  function handleSave() {
    persistAccountProfilePreferences({
      displayName: displayName.trim().length > 0 ? displayName.trim() : defaultPreferences.displayName,
      profileNote,
      hideBalances,
      blurNotifications,
      requireExportReview,
    });
    setSaveState("working");
    setTimeout(() => {
      setSaveState("done");
      showAccountStatus(
        "Saved the local profile for this phone. Name and note are live here, while privacy rows stay blocked until native enforcement lands.",
        "success",
      );
      setTimeout(() => setSaveState("idle"), 1200);
    }, 700);
  }

  function handleResetProfile() {
    clearAccountProfilePreferences();
    setDisplayName(defaultPreferences.displayName);
    setProfileNote(defaultPreferences.profileNote);
    setHideBalances(defaultPreferences.hideBalances);
    setBlurNotifications(defaultPreferences.blurNotifications);
    setRequireExportReview(defaultPreferences.requireExportReview);
    showAccountStatus(
      "Local profile preferences were reset on this device.",
      "warning",
    );
  }

  return (
    <section className="space-y-8">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <MotionPanel className="space-y-2">
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Local profile
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          Update the name and note that this phone uses locally.
        </p>
      </MotionPanel>

      <MotionPanel
        className="rounded-[28px] border border-outline-variant/20 bg-surface-container p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
        delay={50}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-surface bg-surface text-primary shadow-sm">
                <MaterialSymbol className="text-[34px]" filled name="person" />
              </div>
              <span className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-primary p-1 text-on-primary">
                <MaterialSymbol className="text-[14px]" filled name="photo_camera" />
              </span>
            </div>
            <div>
              <p className="font-headline text-2xl font-semibold text-on-surface">
                {displayName}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Profile image stays local to this phone.
              </p>
            </div>
          </div>
          <div className="max-w-xs rounded-2xl border border-outline-variant/30 bg-surface px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Profile photo
            </p>
            <p className="mt-2 text-sm font-semibold text-on-surface">
              Not live yet.
            </p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              Display name and profile note save locally now. Privacy and export
              protections stay visible below as blocked or coming-soon rows
              until native enforcement and export-review flows land.
            </p>
          </div>
        </div>
      </MotionPanel>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <MotionPanel
          className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={110}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Display name
            </span>
            <input
              className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
              onChange={(event) => setDisplayName(event.target.value)}
              type="text"
              value={displayName}
            />
          </label>
          <label className="block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="block text-sm font-semibold text-on-surface">
                Description
              </span>
              <StatusChip icon="phone_iphone" tone="neutral">
                Local on this phone
              </StatusChip>
            </div>
            <textarea
              className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
              onChange={(event) => setProfileNote(event.target.value)}
              rows={4}
              value={profileNote}
            />
          </label>
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm font-semibold text-on-surface">
              Identity posture
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Use the name and note that should represent this phone.
            </p>
          </div>
        </MotionPanel>

        <MotionPanel
          className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={170}
        >
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-sm font-semibold text-on-surface">
              Privacy controls
            </p>
            <div className="mt-4 space-y-3">
              {[
                {
                  label: "App switcher balance masking",
                  detail:
                    "Blocked until the Android shell can actually hide balance figures outside the app.",
                  state: hideBalances ? "Stored default: On" : "Stored default: Off",
                  tone: "warning" as const,
                  chipLabel: "Blocked",
                },
                {
                  label: "Lock-screen notification privacy",
                  detail:
                    "Coming soon once notification redaction is wired into the native runtime.",
                  state: blurNotifications ? "Stored default: On" : "Stored default: Off",
                  tone: "warning" as const,
                  chipLabel: "Coming soon",
                },
                {
                  label: "Export confirmation gate",
                  detail:
                    "Tracked as a stored default only until real export-review enforcement joins the package flow.",
                  state: requireExportReview
                    ? "Stored default: On"
                    : "Stored default: Off",
                  tone: "neutral" as const,
                  chipLabel: "Saved status",
                },
              ].map((item) => (
                <div
                  className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4"
                  key={item.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        {item.detail}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        {item.state}
                      </p>
                    </div>
                    <StatusChip icon="block" tone={item.tone}>
                      {item.chipLabel}
                    </StatusChip>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Profile export package
                </p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Coming soon. Use Data &amp; Storage for the real working export
                  and backup flows in this alpha.
                </p>
              </div>
              <StatusChip icon="schedule" tone="warning">
                Coming soon
              </StatusChip>
            </div>
          </div>
          <button
            className={`w-full rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-semibold text-error ${pressableClass}`}
            onClick={handleResetProfile}
            type="button"
          >
            Clear local profile cache
          </button>
        </MotionPanel>
      </div>

      <ActionStatusButton
        actionState={saveState}
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.08)]"
        doneLabel="Saved"
        idleLabel="Save local profile"
        onClick={handleSave}
        workingLabel="Saving..."
      />
    </section>
  );
}

function AppearancePage({
  orderedAccountIds = [],
  demoModeEnabled = readDemoModeEnabled(),
  onRequestEnableDemoMode = () => undefined,
}: {
  orderedAccountIds?: readonly string[];
  demoModeEnabled?: boolean;
  onRequestEnableDemoMode?: () => void;
}) {
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const [theme] = useState<"light" | "dark" | "system">("light");
  const [fontScale] = useState("3");
  const [density] = useState<"compact" | "balanced" | "spaced">(
    "balanced",
  );
  const [currencyLabel, setCurrencyLabel] = useState<CurrencyLabelPreference>(() =>
    readCurrencyLabelPreference(),
  );
  const [bottomNavStyle, setBottomNavStyle] =
    useState<BottomNavStylePreference>(() => readBottomNavStylePreference());
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(() =>
    readDefaultAccountIdPreference(),
  );
  const [accountOrderIds, setAccountOrderIds] = useState<string[]>(() =>
    orderedAccountIds.length > 0
      ? [...orderedAccountIds]
      : accountSummaries.map((account) => account.accountId),
  );
  const [selectedAccent] = useState("forest");
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  function handleSave() {
    setSaveState("working");
    setTimeout(() => {
      persistCurrencyLabelPreference(currencyLabel);
      persistBottomNavStylePreference(bottomNavStyle);
      persistDefaultAccountIdPreference(defaultAccountId);
      persistAccountOrderPreference(accountOrderIds);
      setSaveState("done");
      setStatusToast({
        tone: "success",
        message:
          "Saved the live appearance settings for this phone. Theme, accent, typography, and density remain preview-only in this alpha.",
      });
      setTimeout(() => setSaveState("idle"), 1200);
      setTimeout(() => setStatusToast(null), 2200);
    }, 700);
  }

  useEffect(() => {
    if (accountSummaries.length === 0) {
      setAccountOrderIds([]);
      return;
    }

    setAccountOrderIds((current) => {
      const source =
        orderedAccountIds.length > 0
          ? [...orderedAccountIds]
          : accountSummaries.map((account) => account.accountId);
      const existing = source.filter((accountId) =>
        accountSummaries.some((account) => account.accountId === accountId),
      );
      const missing = accountSummaries
        .map((account) => account.accountId)
        .filter((accountId) => !existing.includes(accountId));
      return [...existing, ...missing];
    });
  }, [accountSummaries, orderedAccountIds]);

  const orderedAccounts = useMemo(() => {
    const rank = new Map(accountOrderIds.map((accountId, index) => [accountId, index]));
    return [...accountSummaries].sort(
      (left, right) =>
        (rank.get(left.accountId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.accountId) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [accountOrderIds, accountSummaries]);

  function moveAccount(accountId: string, direction: "up" | "down") {
    setAccountOrderIds((current) => {
      const index = current.indexOf(accountId);

      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [account] = next.splice(index, 1);
      next.splice(nextIndex, 0, account);
      return next;
    });
  }

  return (
    <section className="space-y-10">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <MotionPanel className="space-y-2">
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Appearance
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          Live on this phone: showcase mode, currency label, default account,
          navigation dock, and account order. Theme, accent, typography, and
          density stay preview-only in this alpha.
        </p>
      </MotionPanel>

      <MotionPanel className="space-y-4" delay={20}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-on-surface">
              Showcase mode
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Loads sample data for the walkthrough.
            </p>
          </div>
          <StatusChip
            icon={demoModeEnabled ? "science" : "check_circle"}
            tone={demoModeEnabled ? "warning" : "success"}
          >
            {demoModeEnabled ? "Active" : "Off"}
          </StatusChip>
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <p className="text-sm leading-6 text-on-surface-variant">
            {demoModeEnabled
              ? "Showcase is active on this phone. Return to private mode from the top bar."
              : "Load showcase again if you need the walkthrough. It replaces local finance data on this phone."}
          </p>
          {!demoModeEnabled ? (
            <div className="mt-4 flex justify-end">
              <button
                className={`rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary ${pressableClass}`}
                onClick={onRequestEnableDemoMode}
                type="button"
              >
                Load showcase mode
              </button>
            </div>
          ) : null}
        </div>
      </MotionPanel>

      <MotionPanel className="space-y-4" delay={40}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline text-2xl font-semibold text-on-surface">
            Theme
          </h3>
          <StatusChip icon="visibility" tone="warning">
            Preview only in this alpha
          </StatusChip>
        </div>
        <p className="text-sm text-on-surface-variant">
          Shared theming is still in the cross-surface lane, so these previews
          stay visible for review but do not save or apply yet.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {([
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
            { id: "system", label: "System" },
          ] as const).map((option) => (
            <button
              aria-pressed={theme === option.id}
              className={`group flex cursor-not-allowed flex-col items-center gap-4 rounded-xl p-1 text-left opacity-70 transition`}
              disabled
              key={option.id}
              type="button"
            >
              <div
                className={`relative w-full overflow-hidden rounded-xl border-2 p-4 ${
                  theme === option.id
                    ? "border-primary bg-surface-container shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
                    : "border-transparent bg-surface-variant"
                }`}
              >
                <div
                  className={`flex aspect-[4/3] flex-col gap-2 rounded-lg p-3 ${
                    option.id === "dark" ? "bg-[#2e3230]" : "bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-6 w-6 rounded-full ${
                        option.id === "dark"
                          ? "bg-[#1e201f]"
                          : "bg-primary-container"
                      }`}
                    />
                    <div
                      className={`h-3 w-16 rounded-full ${
                        option.id === "dark"
                          ? "bg-[#4a4e4a]"
                          : "bg-surface-container-high"
                      }`}
                    />
                  </div>
                  <div
                    className={`mt-2 flex-1 rounded-md p-2 ${
                      option.id === "dark"
                        ? "bg-[#1e201f]"
                        : "bg-surface-container-low"
                    }`}
                  >
                    <div
                      className={`h-4 rounded ${
                        option.id === "dark"
                          ? "bg-[#4a4e4a]"
                          : "bg-surface-container-highest"
                      }`}
                    />
                    <div
                      className={`mt-2 h-4 w-3/4 rounded ${
                        option.id === "dark"
                          ? "bg-[#4a4e4a]"
                          : "bg-surface-container-highest"
                      }`}
                    />
                  </div>
                </div>
                {theme === option.id ? (
                  <div className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
                    <MaterialSymbol
                      className="text-[16px]"
                      filled
                      name="check"
                    />
                  </div>
                ) : null}
              </div>
              <span
                className={`text-lg ${
                  theme === option.id
                    ? "font-semibold text-on-surface"
                    : "font-medium text-on-surface-variant"
                }`}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </MotionPanel>

      <div className="h-px bg-outline-variant/30" />

      <MotionPanel className="space-y-6" delay={90}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline text-2xl font-semibold text-on-surface">
            Color Accent
          </h3>
          <StatusChip icon="visibility" tone="warning">
            Preview only in this alpha
          </StatusChip>
        </div>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            {appearanceAccents.map((accent) => (
              <button
                aria-pressed={selectedAccent === accent.id}
                className={`flex h-14 w-14 shrink-0 cursor-not-allowed items-center justify-center rounded-full opacity-70 ${
                  accent.color
                } ${
                  selectedAccent === accent.id
                    ? "ring-4 ring-primary-container/40 ring-offset-2 ring-offset-surface-container-low"
                    : ""
                }`}
                disabled
                key={accent.id}
                type="button"
              >
                {selectedAccent === accent.id ? (
                  <MaterialSymbol
                    className="text-on-primary"
                    filled
                    name="check"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </MotionPanel>

      <div className="grid gap-6 md:grid-cols-2">
        <MotionPanel
          className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={110}
        >
          <h3 className="font-headline text-xl font-semibold text-on-surface">
            Currency label
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Pick how the currency mark is shown across key totals.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["ETB", "Br", "Birr"] as const).map((label) => (
              <button
                aria-pressed={currencyLabel === label}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${pressableClass} ${
                  currencyLabel === label
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant"
                }`}
                key={label}
                onClick={() => setCurrencyLabel(label)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </MotionPanel>

          <MotionPanel
            className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
            delay={145}
          >
          <h3 className="font-headline text-xl font-semibold text-on-surface">
            Default account
          </h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            This account stays pinned first in the Home pocket stack.
          </p>
          <div className="mt-5 space-y-3">
            {accountSummaries.length > 0 ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Select account
                  </span>
                  <select
                    className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                    onChange={(event) =>
                      setDefaultAccountId(event.target.value || null)
                    }
                    value={defaultAccountId ?? ""}
                  >
                    {orderedAccounts.map((account) => (
                      <option key={account.accountId} value={account.accountId}>
                        {account.institutionName} • {account.maskedAccountNumber}
                      </option>
                    ))}
                  </select>
                </label>
                {defaultAccountId ? (
                  <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-on-surface-variant">
                    Pinned first:{" "}
                    <span className="font-semibold text-on-surface">
                      {orderedAccounts.find((account) => account.accountId === defaultAccountId)
                        ?.institutionName ?? "Selected account"}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/24 bg-surface p-4 text-sm text-on-surface-variant">
                Default account becomes available once tracked accounts exist.
              </div>
              )}
            </div>
          </MotionPanel>
        </div>

        <MotionPanel
          className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={170}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-headline text-xl font-semibold text-on-surface">
                Navigation dock
              </h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Choose whether the add action floats between split rails or sits
                above one curved dock.
              </p>
            </div>
            <StatusChip icon="dock" tone="neutral">
              Mobile only
            </StatusChip>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {bottomNavStyleOptions.map((option) => {
              const isSelected = bottomNavStyle === option.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`rounded-[24px] border p-4 text-left transition ${pressableClass} ${
                    isSelected
                      ? "border-primary/30 bg-primary/8"
                      : "border-outline-variant/18 bg-surface"
                  }`}
                  key={option.id}
                  onClick={() => {
                    setBottomNavStyle(option.id);
                    persistBottomNavStylePreference(option.id);
                    setStatusToast({
                      tone: "success",
                      message:
                        "Navigation dock style switched for the live app shell.",
                    });
                  }}
                  type="button"
                >
                  <div className="relative h-[112px] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#243041,#30445e)] px-4 pt-4">
                    {option.id === "detached" ? (
                      <div className="absolute inset-x-4 bottom-4 grid grid-cols-[minmax(0,1fr)_58px_minmax(0,1fr)] items-end gap-2">
                        <div className="flex h-[42px] items-center justify-evenly rounded-[18px] bg-white/95 px-2 shadow-[0_8px_22px_rgba(20,24,28,0.18)]">
                          <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                          <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                        </div>
                        <div className="relative flex justify-center">
                          <div className="absolute bottom-0 h-12 w-12 rounded-full bg-[#66a06e]/30 blur-lg" />
                          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#4a7c59] ring-[5px] ring-[#eef2eb]">
                            <span className="text-lg font-semibold text-white">+</span>
                          </div>
                        </div>
                        <div className="flex h-[42px] items-center justify-evenly rounded-[18px] bg-white/95 px-2 shadow-[0_8px_22px_rgba(20,24,28,0.18)]">
                          <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                          <span className="h-2 w-2 rounded-full bg-[#9bc3a2]" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-x-4 bottom-4">
                        <div className="absolute inset-x-0 bottom-0 h-[48px] rounded-[20px] bg-white/95 shadow-[0_10px_24px_rgba(20,24,28,0.18)]" />
                        <div className="absolute left-1/2 top-[-18px] h-[56px] w-[56px] -translate-x-1/2 rounded-full bg-[#243041]" />
                        <div className="absolute left-1/2 top-[-8px] h-[44px] w-[44px] -translate-x-1/2 rounded-full bg-[#4a7c59] ring-[5px] ring-[#eef2eb]" />
                        <div className="relative grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-end gap-2 px-2 pt-2">
                          <div className="flex h-[42px] items-center justify-evenly">
                            <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                            <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                          </div>
                          <div />
                          <div className="flex h-[42px] items-center justify-evenly">
                            <span className="h-2 w-2 rounded-full bg-[#6f7e84]" />
                            <span className="h-2 w-2 rounded-full bg-[#9bc3a2]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                        {option.description}
                      </p>
                    </div>
                    {isSelected ? (
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-on-primary">
                        Active
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </MotionPanel>

        <div className="grid gap-6 md:grid-cols-2">
          <MotionPanel
            className="flex flex-col justify-between rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={180}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-headline text-xl font-semibold text-on-surface">
                Typography
              </h3>
              <StatusChip icon="schedule" tone="warning">
                Preview only
              </StatusChip>
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">
              Text scaling is not wired into the shared shell yet.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <MaterialSymbol className="text-sm text-on-surface-variant" name="format_size" />
            <input
              className="h-2 w-full cursor-not-allowed appearance-none rounded-lg bg-surface-variant accent-primary opacity-70"
              disabled
              max="5"
              min="1"
              type="range"
              value={fontScale}
            />
            <MaterialSymbol className="text-2xl text-on-surface-variant" name="format_size" />
          </div>
        </MotionPanel>

        <MotionPanel
          className="flex flex-col justify-between rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={220}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-headline text-xl font-semibold text-on-surface">
                Layout Density
              </h3>
              <StatusChip icon="schedule" tone="warning">
                Preview only
              </StatusChip>
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">
              Density controls will land when the shared mobile shell supports
              global spacing tokens.
            </p>
          </div>
          <div className="mt-6 flex overflow-hidden rounded-lg border border-outline-variant/40 bg-surface">
            {(["compact", "balanced", "spaced"] as const).map((option) => (
              <button
                aria-pressed={density === option}
                className={`flex-1 cursor-not-allowed py-3 text-sm font-medium capitalize opacity-70 ${
                  density === option
                    ? "bg-primary-container/20 font-semibold text-primary"
                    : "text-on-surface-variant"
                }`}
                disabled
                key={option}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </MotionPanel>
      </div>

      <MotionPanel
        className="rounded-[26px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
        delay={260}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="font-headline text-xl font-semibold text-on-surface">
              Account deck order
            </h3>
            <StatusChip icon="account_balance_wallet" tone="success">
              Home and Accounts
            </StatusChip>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
            Choose which card leads the deck first, then which ones follow behind it.
          </p>
        </div>
        <div className="mt-5 space-y-3">
          {orderedAccounts.map((account, index) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
              key={account.accountId}
            >
              <div className="min-w-0">
                <p className="font-semibold text-on-surface">{account.institutionName}</p>
                <p className="text-xs text-on-surface-variant">
                  #{index + 1} • {account.maskedAccountNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveAccount(account.accountId, "up")}
                  type="button"
                >
                  <MaterialSymbol name="keyboard_arrow_up" />
                </button>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant disabled:opacity-40"
                  disabled={index === orderedAccounts.length - 1}
                  onClick={() => moveAccount(account.accountId, "down")}
                  type="button"
                >
                  <MaterialSymbol name="keyboard_arrow_down" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </MotionPanel>

      <ActionStatusButton
        actionState={saveState}
        className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.08)]"
        doneLabel="Applied"
        idleLabel="Save appearance"
        onClick={handleSave}
        workingLabel="Applying..."
      />
    </section>
  );
}

function SecurityPage() {
  const trustedSyncDevices = useTransactionStore((state) => state.trustedSyncDevices);
  const persistedSecurityPreferences = useMemo(
    () => readSecurityPreferences(),
    [],
  );
  const [isBiometricsPanelOpen, setIsBiometricsPanelOpen] = useState(false);
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  const deviceRows = useMemo(
    () => [
      {
        id: "current-device",
        name: "Current Phone",
        meta: "This device",
        icon: "phone_iphone",
        current: true,
      },
      ...trustedSyncDevices.map((device) => ({
        id: device.deviceId,
        name: device.displayName,
        meta:
          device.lastSyncedAt === null
            ? "Trusted route"
            : `Synced ${formatShortDateTime(device.lastSyncedAt)}`,
        icon: materialForDevice(device),
        current: false,
      })),
    ],
    [trustedSyncDevices],
  );

  function showSecurityStatus(message: string, tone: StatusTone = "warning") {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2200);
  }

  return (
    <section className="space-y-8">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-headline text-3xl font-semibold text-on-surface">
            Security &amp; Privacy
          </h2>
          <StatusChip icon="visibility" tone="warning">
            Read-only status
          </StatusChip>
        </div>
        <p className="text-sm leading-6 text-on-surface-variant">
          Native biometric prompts, secure secret storage, and remote
          verification are not active in this alpha. This page now shows status
          honestly instead of presenting live-looking security switches.
        </p>
      </header>

      <MotionPanel className="rounded-[24px] border border-tertiary/18 bg-tertiary-container/20 p-5 shadow-[0_4px_20px_rgba(46,50,48,0.04)]">
        <p className="text-sm font-semibold text-on-surface">
          Security &amp; Privacy
        </p>
        <p className="text-sm leading-6 text-on-surface-variant">
          Stored plan values from this phone are still visible for audit and
          migration, but every protection below stays blocked or coming soon
          until it has real platform backing.
        </p>
      </MotionPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                <MaterialSymbol className="text-lg" filled name="fingerprint" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  Biometric unlock
                </h3>
                <p className="mb-3 mt-1 text-sm text-on-surface-variant">
                  The stored plan stays visible, but biometrics are blocked
                  until native prompts can actually run on-device.
                </p>
                <button
                  className="rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-1.5 text-sm font-semibold text-primary"
                  onClick={() => setIsBiometricsPanelOpen(true)}
                  type="button"
                >
                  Review protection status
                </button>
              </div>
            </div>
            <StatusChip icon="block" tone="warning">
              Blocked until native prompts
            </StatusChip>
          </article>

          <article className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container/20 text-tertiary">
                <MaterialSymbol className="text-lg" filled name="phonelink_lock" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  2-Step Verification
                </h3>
                <p className="mb-3 mt-1 text-sm text-on-surface-variant">
                  Account-level verification is not wired into the mobile
                  authority path yet, so this stays visible as roadmap status
                  only.
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-1 text-xs text-on-surface-variant">
                  <MaterialSymbol className="text-[14px]" name="verified_user" />
                  Authority work pending
                </div>
              </div>
            </div>
            <StatusChip icon="schedule" tone="warning">
              Coming soon
            </StatusChip>
          </article>

          <article className="rounded-xl border border-outline-variant/30 bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  Stored protection plan
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Existing values from this phone remain visible for migration
                  and audit, but none of them are enforced live yet.
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Biometrics {persistedSecurityPreferences.biometricsEnabled ? "planned on" : "planned off"}
                  {" "}• 2-step {persistedSecurityPreferences.twoFactorEnabled ? "planned on" : "planned off"}
                </p>
              </div>
              <StatusChip icon="visibility" tone="neutral">
                Visible only
              </StatusChip>
            </div>
          </article>
        </div>

        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface">
          <div className="border-b border-outline-variant/20 bg-surface-container-lowest p-3">
            <h3 className="flex items-center gap-2 font-headline text-base font-semibold text-on-surface">
              <MaterialSymbol className="text-lg text-primary" name="devices" />
              Device Preview
            </h3>
          </div>
          <div className="p-1">
            {deviceRows.map((device) => (
              <div
                className="group mt-0.5 flex items-center justify-between rounded-lg p-2 transition hover:bg-surface-container-low"
                key={device.id}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      device.current
                        ? "bg-primary-container/20 text-primary"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <MaterialSymbol className="text-sm" name={device.icon} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {device.name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {device.meta}
                    </p>
                  </div>
                </div>
                <StatusChip icon="visibility" tone="warning">
                  Preview
                </StatusChip>
              </div>
            ))}
          </div>
          <div className="border-t border-outline-variant/20 bg-surface-container-low p-3">
            <p className="text-xs leading-5 text-on-surface-variant">
              Trusted-device rows come from the local sync preview only. Remote
              revoke and sign-out stay hidden until transport-backed auth exists.
            </p>
          </div>
        </section>
      </div>

      {isBiometricsPanelOpen ? (
        <OverlayPanel
          onClose={() => setIsBiometricsPanelOpen(false)}
          subtitle="Stored values from this phone remain visible here, but none of them trigger native or authority-backed enforcement yet."
          title="Protection status"
        >
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4 rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="space-y-3">
                {[
                  {
                    label: "Require biometrics to open Track Wallet",
                    detail:
                      "Blocked until native unlock prompts can actually gate the app shell.",
                    checked: persistedSecurityPreferences.requireBiometricOnOpen,
                  },
                  {
                    label: "Require biometrics before approval",
                    detail:
                      "Blocked until native confirmation prompts can run before approvals.",
                    checked: persistedSecurityPreferences.requireBiometricOnApprove,
                  },
                  {
                    label: "Require biometrics before delete",
                    detail:
                      "Blocked until destructive edits can call real device prompts.",
                    checked: persistedSecurityPreferences.requireBiometricOnDelete,
                  },
                  {
                    label: "Require biometrics for forwarding changes",
                    detail:
                      "Blocked until routing edits have a native prompt boundary.",
                    checked: persistedSecurityPreferences.requireBiometricOnForwarding,
                  },
                ].map((rule) => (
                  <div
                    className="rounded-2xl bg-surface p-4"
                    key={rule.label}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-on-surface">
                          {rule.label}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {rule.detail}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                          Stored default: {rule.checked ? "On" : "Off"}
                        </p>
                      </div>
                      <StatusChip icon="block" tone="warning">
                        Blocked
                      </StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5">
              <p className="text-sm font-semibold text-on-surface">
                Current platform note
              </p>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                The authority store still carries any migrated or previously
                saved plan values, which is useful for inspection and future
                migration. Real OS biometric prompts, secure enclave-backed
                secrets, and revocation flows still need native platform
                wiring.
              </p>
              <button
                className="mt-5 rounded-xl border border-outline-variant/24 bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface-variant"
                onClick={() =>
                  showSecurityStatus(
                    "Protection controls remain read-only here until native enforcement is implemented.",
                    "warning",
                  )
                }
                type="button"
              >
                Why editing is blocked
              </button>
            </section>
          </div>
        </OverlayPanel>
      ) : null}
    </section>
  );
}

function ParsingPage({ onOpenTab }: { onOpenTab: (tabId: AppTabId) => void }) {
  type ParserWorkspaceTab = "templates" | "sandbox" | "diagnostics";
  const initialParserTemplates = useMemo(
    () => cloneDefaultParserTemplates(),
    [],
  );

  const persistedWorkspace = useMemo(() => readParserWorkspacePreferences(), []);
  const persistedResolvedTemplates = useMemo(
    () =>
      persistedWorkspace
        ? resolveParserTemplateWorkspace(persistedWorkspace.templateWorkspace)
        : initialParserTemplates,
    [initialParserTemplates, persistedWorkspace],
  );
  const [activeParserTab, setActiveParserTab] =
    useState<ParserWorkspaceTab>("templates");
  const [senderLabel, setSenderLabel] = useState<string>(
    persistedWorkspace?.senderLabel ?? "CBE",
  );
  const approvedTransactions = useTransactionStore(
    (state) => state.approvedTransactions,
  );
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const [templateCards, setTemplateCards] = useState<ParserTemplateDefinition[]>(
    persistedResolvedTemplates,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    persistedWorkspace?.selectedTemplateId ||
      persistedResolvedTemplates[0]?.id ||
      "",
  );
  const [sandboxInputMode, setSandboxInputMode] = useState<"latest" | "manual">(
    "latest",
  );
  const [rawInput, setRawInput] = useState(parserSandboxFallbackSamples.CBE);
  const [feedback, setFeedback] = useState(
    "Run tests here, then send trusted drafts into Inbox through the live parser path.",
  );
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [queueState, setQueueState] = useState<ActionState>("idle");
  const [isFocusedEditorOpen, setIsFocusedEditorOpen] = useState(false);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [strictSchemaParsing, setStrictSchemaParsing] = useState(
    persistedWorkspace?.strictSchemaParsing ?? true,
  );
  const [preserveRawSms, setPreserveRawSms] = useState(
    persistedWorkspace?.preserveRawSms ?? true,
  );
  const [autoReconciliation, setAutoReconciliation] = useState(
    persistedWorkspace?.autoReconciliation ?? false,
  );
  const [verboseLogging, setVerboseLogging] = useState(
    persistedWorkspace?.verboseLogging ?? false,
  );
  const [templateBuilderDraft, setTemplateBuilderDraft] = useState({
    ...createTemplateBuilderSeed(senderLabel),
  });
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  const parserPackInputRef = useRef<HTMLInputElement | null>(null);
  const parserWorkspaceModel = useMemo(
    () => migrateResolvedTemplatesToWorkspace(templateCards),
    [templateCards],
  );
  const parserRuntimeOptions = useMemo(
    () =>
      buildParserRuntimeOptionsFromWorkspace(parserWorkspaceModel, {
        preferredTemplateId: selectedTemplateId,
        includeDraftTemplates: true,
      }),
    [parserWorkspaceModel, selectedTemplateId],
  );
  const { previewResult, parseAndQueue } = useParser(rawInput, senderLabel, {
    runtime: parserRuntimeOptions,
    verboseLogging,
  });
  const openTransactionEditor = useTransactionStore(
    (state) => state.openTransactionEditor,
  );

  const latestCapturedMessage = useMemo(() => {
    const latestQueueMatch = approvalQueue.find((queueItem) =>
      matchesParserSenderFamily(senderLabel, queueItem.senderLabel),
    );

    if (latestQueueMatch) {
      return latestQueueMatch.rawBody;
    }

    const latestUnmatchedMatch = unmatchedMessages.find((message) =>
      matchesParserSenderFamily(senderLabel, message.senderLabel),
    );

    return (
      latestUnmatchedMatch?.smsBody ??
      parserSandboxFallbackSamples[senderLabel] ??
      parserSandboxFallbackSamples.CBE
    );
  }, [approvalQueue, senderLabel, unmatchedMessages]);

  useEffect(() => {
    if (sandboxInputMode !== "latest") {
      return;
    }

    setRawInput(latestCapturedMessage);
  }, [latestCapturedMessage, sandboxInputMode]);

  useEffect(() => {
    if (templateCards.some((template) => template.id === selectedTemplateId)) {
      return;
    }

    setSelectedTemplateId(templateCards[0]?.id ?? "");
  }, [selectedTemplateId, templateCards]);

  useEffect(() => {
    persistParserWorkspacePreferences({
      version: 3,
      templateWorkspace: parserWorkspaceModel,
      selectedTemplateId,
      senderLabel,
      strictSchemaParsing,
      preserveRawSms,
      autoReconciliation,
      verboseLogging,
    });
  }, [
    autoReconciliation,
    parserWorkspaceModel,
    preserveRawSms,
    selectedTemplateId,
    senderLabel,
    strictSchemaParsing,
    verboseLogging,
  ]);

  const selectedTemplate = useMemo(
    () =>
      templateCards.find((template) => template.id === selectedTemplateId) ??
      templateCards[0] ??
      null,
    [selectedTemplateId, templateCards],
  );
  const selectedTemplateInspection = useMemo(
    () => (selectedTemplate ? inspectParserTemplate(selectedTemplate) : null),
    [selectedTemplate],
  );

  const groupedTemplates = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        icon: string;
        templates: ParserTemplateDefinition[];
      }
    >();

    for (const template of templateCards) {
      const groupKey = getInstitutionKeyForTemplate(template);
      const current = groups.get(groupKey);

      if (current) {
        current.templates.push(template);
      } else {
        groups.set(groupKey, {
          label: template.institutionLabel,
          icon: template.institutionIcon,
          templates: [template],
        });
      }
    }

    return [...groups.entries()];
  }, [templateCards]);

  const parserSource = useMemo(() => {
    if (!selectedTemplate || !selectedTemplateInspection) {
      return "";
    }

    return buildParserSourceFromBindings(
      selectedTemplateInspection.bindings,
      selectedTemplate,
    );
  }, [selectedTemplate, selectedTemplateInspection]);

  const previewRows = useMemo(() => {
    if (previewResult.status !== "matched") {
      return [
        ["status", "unmatched"],
        ["reason", previewResult.failureReason],
        ["sender", previewResult.senderLabel],
        ["template", "none"],
      ] as Array<[string, string]>;
    }

    return [
      ["amount", `ETB ${(previewResult.draft.amountMinor / 100).toFixed(2)}`],
      ["merchant", previewResult.draft.merchantName],
      ["date", previewResult.draft.occurredAt.slice(0, 10)],
      [
        "balance",
        previewResult.draft.reportedBalanceMinor
          ? `ETB ${(previewResult.draft.reportedBalanceMinor / 100).toFixed(2)}`
          : "null",
      ],
      ["template", previewResult.draft.parserTemplateId],
      ["category", TRANSACTION_CATEGORY_LABELS[previewResult.draft.category]],
    ] as Array<[string, string]>;
  }, [previewResult]);

  const totalTemplateMatches = useMemo(
    () =>
      approvedTransactions.filter((transaction) =>
        templateCards.some((template) => template.id === transaction.parserTemplateId),
      ).length,
    [approvedTransactions, templateCards],
  );

  const activeTemplateCount = useMemo(
    () => templateCards.filter((template) => template.status === "active").length,
    [templateCards],
  );

  const driftConfidence = useMemo(() => {
    const denominator = totalTemplateMatches + unmatchedMessages.length;
    if (denominator <= 0) {
      return 100;
    }

    return Math.max(
      55,
      Math.min(100, Math.round((totalTemplateMatches / denominator) * 100)),
    );
  }, [totalTemplateMatches, unmatchedMessages.length]);

  const driftLabel =
    driftConfidence >= 95 ? "Low" : driftConfidence >= 82 ? "Watch" : "Elevated";

  const bankCoveragePercent = useMemo(() => {
    const supportedInstitutions = new Set(
      templateCards
        .filter((template) => template.status !== "disabled")
        .map((template) => getInstitutionKeyForTemplate(template)),
    );
    return Math.round(
      (supportedInstitutions.size / parserSenderOptions.length) * 100,
    );
  }, [templateCards]);

  const recentParserAlert = unmatchedMessages[0];

  function showParserStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2200);
  }

  function handleSave() {
    setSaveState("working");
    setTimeout(() => {
      setTemplateCards((current) =>
        current.map((template) =>
          template.id === selectedTemplate?.id
            ? {
                ...template,
                updated: "Updated just now",
              }
            : template,
        ),
      );
      setSaveState("done");
      showParserStatus(
        "Template workspace saved into parser authority state on this phone.",
        "success",
      );
      setTimeout(() => setSaveState("idle"), 1200);
    }, 700);
  }

  function handleQueue() {
    setQueueState("working");
    setFeedback("Queueing...");

    setTimeout(() => {
      const result = parseAndQueue({
        address: senderLabel,
        body: rawInput,
        timestamp_ms: Date.now(),
      });

      if (result.status === "queued") {
        openTransactionEditor(result.queueEntryId);
        setFeedback("Queued the parsed SMS and opened it in Inbox for review.");
        showParserStatus(
          "Parser draft queued successfully and handed off to Inbox.",
          "success",
        );
        setQueueState("done");
        setTimeout(() => setQueueState("idle"), 1200);
        onOpenTab("inbox");
        return;
      }

      setFeedback(
        "No parser template matched. The raw SMS was routed into the parser error queue for review.",
      );
      showParserStatus(
        "This message stayed unmatched. Review it in Inbox before changing parser rules.",
        "warning",
      );
      setQueueState("idle");
      onOpenTab("inbox");
    }, 900);
  }

  function handleSandboxTest() {
    if (previewResult.status === "matched") {
      setFeedback(
        "Sandbox test matched. Review the parsed fields below before queueing.",
      );
      showParserStatus("Sandbox test matched this message.", "success");
      return;
    }

    setFeedback(
      "Sandbox test stayed unmatched. Adjust the sample SMS or extraction rule before queueing.",
    );
    showParserStatus("Sandbox test stayed unmatched.", "warning");
  }

  function updateSelectedTemplate(
    updater: (template: ParserTemplateDefinition) => ParserTemplateDefinition,
  ) {
    if (!selectedTemplate) {
      return;
    }

    setTemplateCards((current) =>
      current.map((template) =>
        template.id === selectedTemplate.id ? updater(template) : template,
      ),
    );
  }

  function handleDuplicateTemplate() {
    if (!selectedTemplate) {
      return;
    }

    const duplicatedTemplate: ParserTemplateDefinition = {
      ...selectedTemplate,
      id: `${selectedTemplate.id}-copy-${Date.now()}`,
      name: `${selectedTemplate.name} Copy`,
      version: "v0.1.0",
      updated: "Updated just now",
      status: "draft",
      sourceType: "local",
      senderAliases: [...selectedTemplate.senderAliases],
    };

    setTemplateCards((current) => [duplicatedTemplate, ...current]);
    setSelectedTemplateId(duplicatedTemplate.id);
    setSenderLabel(getInstitutionKeyForTemplate(duplicatedTemplate));
    showParserStatus("Duplicated the selected template into a local draft.", "success");
  }

  function handlePrimaryTemplate() {
    if (!selectedTemplate) {
      return;
    }

    setTemplateCards((current) =>
      current.map((template) => {
        if (
          getInstitutionKeyForTemplate(template) !==
          getInstitutionKeyForTemplate(selectedTemplate)
        ) {
          return template;
        }

        if (template.id === selectedTemplate.id) {
          return {
            ...template,
            status: "active",
            updated: "Updated just now",
          };
        }

        if (template.status === "active") {
          return {
            ...template,
            status: "fallback",
          };
        }

        return template;
      }),
    );
    showParserStatus("Marked this template as the primary route.", "success");
  }

  function handleFallbackTemplate() {
    updateSelectedTemplate((template) => ({
      ...template,
      status: "fallback",
      updated: "Updated just now",
    }));
    showParserStatus("Marked this template as a fallback route.", "warning");
  }

  function handleToggleTemplateState() {
    if (!selectedTemplate) {
      return;
    }

    updateSelectedTemplate((template) => ({
      ...template,
      status: template.status === "disabled" ? "active" : "disabled",
      updated: "Updated just now",
    }));
    showParserStatus(
      selectedTemplate.status === "disabled"
        ? "Template re-enabled for live matching."
        : "Template disabled without deleting its history.",
      "warning",
    );
  }

  function handleCreateTemplate() {
    if (!templateBuilderDraft.name.trim() || !templateBuilderDraft.regex.trim()) {
      showParserStatus("Add both a template name and a regex before saving.", "error");
      return;
    }

    const senderOption = getParserSenderOption(templateBuilderDraft.sender);

    const nextTemplate: ParserTemplateDefinition = {
      id: `${senderOption.value.toLowerCase()}-draft-${Date.now()}`,
      financialInstitution: senderOption.financialInstitution,
      institutionKey: senderOption.value,
      institutionLabel: senderOption.label,
      institutionIcon: senderOption.icon,
      senderAliases: [senderOption.value],
      accountIdentifiers: [],
      identityTextFragments: [],
      name: templateBuilderDraft.name.trim(),
      version: "v0.1.0",
      updated: "Updated just now",
      status: "draft",
      regex: templateBuilderDraft.regex.trim(),
      note: "",
      healthScore: null,
      sourceType: "local",
      templateKind: "custom",
      builtInTemplateId: undefined,
      engineEditable: true,
      userProfile: {
        senderAliases: [senderOption.value],
        accountIdentifiers: [],
        identityTextFragments: [],
      },
      direction: templateBuilderDraft.direction,
      amountKey: templateBuilderDraft.amountKey.trim() || "amount",
      merchantKey: templateBuilderDraft.merchantKey.trim() || undefined,
      balanceKey: templateBuilderDraft.balanceKey.trim() || undefined,
      feeKey: templateBuilderDraft.feeKey.trim() || undefined,
      vatKey: templateBuilderDraft.vatKey.trim() || undefined,
      accountKey: templateBuilderDraft.accountKey.trim() || undefined,
      referenceKey: templateBuilderDraft.referenceKey.trim() || undefined,
      dateKey: templateBuilderDraft.dateKey.trim() || undefined,
      timeKey: templateBuilderDraft.timeKey.trim() || undefined,
      meridiemKey: templateBuilderDraft.meridiemKey.trim() || undefined,
      dateMode: templateBuilderDraft.dateMode,
      accountChannel:
        senderOption.financialInstitution === "telebirr" ||
        senderOption.financialInstitution === "cbebirr"
          ? "mobile_money"
          : "bank",
    };
    nextTemplate.note = buildParserTemplateNote(nextTemplate);

    setTemplateCards((current) => [nextTemplate, ...current]);
    setSelectedTemplateId(nextTemplate.id);
    setSenderLabel(senderOption.value);
    setIsTemplateBuilderOpen(false);
    setTemplateBuilderDraft(createTemplateBuilderSeed(senderOption.value));
    showParserStatus("Created a new local draft template.", "success");
  }

  function downloadParserPack() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const payload = {
      kind: "trackwallet-parser-pack",
      version: 1,
      createdAt: new Date().toISOString(),
      templates: templateCards,
      settings: {
        strictSchemaParsing,
        preserveRawSms,
        autoReconciliation,
        verboseLogging,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trackwallet-parser-pack-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    showParserStatus("Exported the local parser pack.", "success");
  }

  async function handleImportParserPack(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        kind?: string;
        templates?: ParserTemplateDefinition[];
        settings?: {
          strictSchemaParsing?: boolean;
          preserveRawSms?: boolean;
          autoReconciliation?: boolean;
          verboseLogging?: boolean;
        };
      };

      if (parsed.kind !== "trackwallet-parser-pack" || !Array.isArray(parsed.templates)) {
        throw new Error("Unsupported parser pack.");
      }

      setTemplateCards(parsed.templates);
      setSelectedTemplateId(parsed.templates[0]?.id ?? "");
      setSenderLabel(getInstitutionKeyForTemplate(parsed.templates[0] ?? initialParserTemplates[0]!));
      setStrictSchemaParsing(parsed.settings?.strictSchemaParsing ?? true);
      setPreserveRawSms(parsed.settings?.preserveRawSms ?? true);
      setAutoReconciliation(parsed.settings?.autoReconciliation ?? false);
      setVerboseLogging(parsed.settings?.verboseLogging ?? false);
      showParserStatus(`Loaded parser pack from ${file.name}.`, "success");
    } catch (error) {
      showParserStatus(
        error instanceof Error ? error.message : "Could not read the parser pack.",
        "error",
      );
    }
  }

  function handlePurgeParserCache() {
    clearParserWorkspacePreferences();
    setTemplateCards(cloneDefaultParserTemplates());
    setSelectedTemplateId(initialParserTemplates[0]?.id ?? "");
    setSenderLabel("CBE");
    setStrictSchemaParsing(true);
    setPreserveRawSms(true);
    setAutoReconciliation(false);
    setVerboseLogging(false);
    setTemplateBuilderDraft(createTemplateBuilderSeed("CBE"));
    showParserStatus(
      "Reset parser authority workspace and preview controls.",
      "warning",
    );
  }

  return (
    <section className="space-y-6 pb-28">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}

      <input
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportParserPack}
        ref={parserPackInputRef}
        type="file"
      />

      <header className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl font-bold text-primary">
              SMS Parsing Logic
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Manage templates, run live tests, inspect parser drift, and send
              trusted drafts into Inbox.
            </p>
          </div>
          <ActionStatusButton
            actionState={saveState}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-primary transition hover:bg-surface-container-high"
            doneLabel="Saved"
            idleLabel="Save"
            onClick={handleSave}
            workingLabel="Saving..."
          />
        </div>

        <nav className="mt-5 flex gap-2">
          {([
            { id: "templates", label: "Templates" },
            { id: "sandbox", label: "Sandbox" },
            { id: "diagnostics", label: "Diagnostics" },
          ] as const).map((tab) => (
            <button
              className={`flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold transition-all ${pressableClass} ${
                activeParserTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface"
              }`}
              key={tab.id}
              onClick={() => setActiveParserTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeParserTab === "templates" ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline text-2xl font-bold text-on-background">
                Regex Templates
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Grouped by sender family with primary, draft, and fallback states.
              </p>
            </div>
            <button
              className={`flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-md transition-transform active:scale-95 ${pressableClass}`}
              onClick={() => setIsTemplateBuilderOpen(true)}
              type="button"
            >
              <MaterialSymbol className="text-sm" name="add" />
              Add Template
            </button>
          </div>

          <div className="space-y-6">
            {groupedTemplates.map(([groupKey, group]) => (
              <div className="space-y-3" key={groupKey}>
                <div className="flex items-center gap-2 px-1 text-on-surface-variant">
                  <MaterialSymbol className="text-lg" name={group.icon} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {group.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {group.templates.map((template) => {
                    const matches = approvedTransactions.filter(
                      (transaction) => transaction.parserTemplateId === template.id,
                    ).length;
                    const statusClass =
                      template.status === "active"
                        ? "bg-primary/10 text-primary"
                        : template.status === "draft"
                          ? "bg-tertiary/10 text-tertiary"
                          : template.status === "fallback"
                            ? "bg-stone-200 text-stone-600"
                            : "bg-error/10 text-error";

                    return (
                      <button
                        className={`rounded-xl border p-5 text-left shadow-sm transition-shadow ${
                          selectedTemplate?.id === template.id
                            ? "border-primary/40 bg-surface shadow-md"
                            : "border-outline-variant/20 bg-surface-container-low hover:shadow-md"
                        } ${pressableClass}`}
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setSenderLabel(getInstitutionKeyForTemplate(template));
                        }}
                        type="button"
                      >
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-lg font-bold text-on-surface">
                              {template.name}
                            </h4>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {template.version} • {template.updated}
                            </p>
                          </div>
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-tight ${statusClass}`}
                          >
                            {template.status}
                          </span>
                        </div>
                        <div className="mb-4 flex gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                              Matches
                            </p>
                            <p className="font-headline text-lg font-semibold text-on-surface">
                              {matches}
                            </p>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                              Success
                            </p>
                            <p className="font-headline text-lg font-semibold text-primary">
                              {template.healthScore ? `${template.healthScore.toFixed(1)}%` : "--"}
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[11px] text-emerald-400/80">
                          {template.regex}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container px-6 py-4">
              <div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  Extraction Function
                </h3>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {selectedTemplate?.note ?? "Select a template to inspect its parsing shape."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`rounded-full border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary ${pressableClass}`}
                  onClick={handleDuplicateTemplate}
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  className={`rounded-full border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary ${pressableClass}`}
                  onClick={handlePrimaryTemplate}
                  type="button"
                >
                  Make primary
                </button>
                <button
                  className={`rounded-full border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary ${pressableClass}`}
                  onClick={handleFallbackTemplate}
                  type="button"
                >
                  Make fallback
                </button>
                <button
                  className={`rounded-full border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary ${pressableClass}`}
                  onClick={handleToggleTemplateState}
                  type="button"
                >
                  {selectedTemplate?.status === "disabled" ? "Enable" : "Disable"}
                </button>
                <button
                  className={`rounded-full border border-outline-variant/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary ${pressableClass}`}
                  onClick={() => setIsFocusedEditorOpen(true)}
                  type="button"
                >
                  Focus editor
                </button>
                <span className="rounded bg-surface-container-highest px-2 py-1 font-mono text-xs text-on-surface-variant">
                  JavaScript
                </span>
              </div>
            </div>
            <div className="overflow-x-auto bg-[#2e3230] p-4 font-mono text-sm leading-relaxed text-[#eae6de]">
              <pre>
                <code>{parserSource}</code>
              </pre>
            </div>
          </section>
        </section>
      ) : null}

      {activeParserTab === "sandbox" ? (
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
              <div className="flex items-center gap-2">
                <MaterialSymbol className="text-primary" name="science" />
                <h3 className="font-headline text-xl font-semibold text-on-surface">
                  Sandbox
                </h3>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
                  Message source
                </span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: "latest", label: "Latest captured" },
                    { id: "manual", label: "Paste manually" },
                  ] as const).map((mode) => (
                    <button
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${pressableClass} ${
                        sandboxInputMode === mode.id
                          ? "bg-primary text-on-primary"
                          : "bg-surface text-on-surface-variant"
                      }`}
                      key={mode.id}
                      onClick={() => {
                        setSandboxInputMode(mode.id);
                        if (mode.id === "latest") {
                          setRawInput(latestCapturedMessage);
                        }
                      }}
                      type="button"
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
                  Sender family
                </span>
                <select
                  className="w-full rounded-lg border-none bg-surface-container-lowest px-3 py-3 text-on-surface focus:ring-2 focus:ring-primary"
                  onChange={(event) => setSenderLabel(event.target.value)}
                  value={senderLabel}
                >
                  {parserSenderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">
                  Paste sample SMS
                </span>
                <textarea
                  className="h-32 w-full resize-none rounded-lg border-none bg-surface-container-lowest p-3 text-sm text-on-surface focus:ring-2 focus:ring-primary"
                  onChange={(event) => setRawInput(event.target.value)}
                  placeholder="Paste a real bank SMS here..."
                  rows={6}
                  value={rawInput}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className={`min-h-12 rounded-xl bg-tertiary px-4 py-3 text-sm font-bold text-on-tertiary shadow-md transition-all hover:opacity-90 active:scale-[0.98] ${pressableClass}`}
                  onClick={handleSandboxTest}
                  type="button"
                >
                  Run Test
                </button>
                <ActionStatusButton
                  actionState={queueState}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
                  doneLabel="Queued"
                  idleLabel="Queue to Inbox"
                  onClick={handleQueue}
                  workingLabel="Queueing..."
                />
              </div>
              <p className="text-xs leading-5 text-on-surface-variant">{feedback}</p>
            </section>

            <section className="space-y-4 rounded-xl border border-emerald-900/30 bg-[#2e3230] p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {previewResult.status === "matched"
                    ? "PARSED_RESULT: SUCCESS"
                    : "PARSED_RESULT: UNMATCHED"}
                </span>
                <span className="font-mono text-[10px] text-stone-500">
                  ms: {previewResult.status === "matched" ? "14.2" : "11.4"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-4 font-mono">
                <div>
                  <p className="text-[10px] uppercase text-emerald-400/40">Field</p>
                  {previewRows.map(([field]) => (
                    <p className="text-sm text-stone-300" key={field}>
                      {field}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-right text-[10px] uppercase text-emerald-400/40">
                    Value
                  </p>
                  {previewRows.map(([field, value]) => (
                    <p className="text-right text-sm text-emerald-400" key={field}>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container p-6">
            <div className="mb-4 flex items-center gap-2">
              <MaterialSymbol className="text-secondary" name="menu_book" />
              <h3 className="font-headline text-lg font-semibold text-on-surface">
                Quick Reference
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  token: "(?<amount>...)",
                  title: "Named capture groups",
                  detail: "Best path for amount, merchant, balance, and account mapping.",
                },
                {
                  token: "\\d+[\\d,]*\\.\\d{2}",
                  title: "Money capture",
                  detail: "Handles ETB values with commas and decimals.",
                },
                {
                  token: "(?:Bal|balance)\\s(?<balance>...)",
                  title: "Reported balance",
                  detail: "Capture the bank-reported remaining balance for reconciliation.",
                },
                {
                  token: "(?<merchant>.*?)",
                  title: "Merchant capture",
                  detail: "Use a non-greedy merchant capture before a balance or reference anchor.",
                },
              ].map((item) => (
                <article
                  className="flex gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3"
                  key={item.token}
                >
                  <code className="h-fit rounded bg-primary-fixed/30 px-2 py-1 font-mono text-primary">
                    {item.token}
                  </code>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.detail}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {activeParserTab === "diagnostics" ? (
        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                Unmatched
              </p>
              <p className="font-headline text-3xl font-bold text-error">
                {unmatchedMessages.length}
              </p>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                Parser error queue
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                Parser Drift
              </p>
              <p className="font-headline text-3xl font-bold text-tertiary">
                {driftLabel}
              </p>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                {driftConfidence}% confidence
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                Active
              </p>
              <p className="font-headline text-3xl font-bold text-primary">
                {activeTemplateCount}
              </p>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                Live routes
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-high p-4">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                Queue
              </p>
              <p className="font-headline text-3xl font-bold text-primary">
                {approvalQueue.length}
              </p>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                Ready for review
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container p-5">
            <h3 className="text-sm font-bold text-on-surface">
              Bank Coverage Progress
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="font-semibold">Supported sender families</span>
                  <span className="font-bold text-primary">
                    {Math.round((bankCoveragePercent / 100) * parserSenderOptions.length)}/
                    {parserSenderOptions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${bankCoveragePercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="font-semibold">Core parser health</span>
                  <span className="font-bold text-primary">{driftConfidence}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${driftConfidence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-xl border border-error/10 bg-error/5 p-4">
            <MaterialSymbol
              className="text-error"
              filled
              name="warning"
            />
            <div>
              <h4 className="text-sm font-bold text-error">Parser Alert</h4>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {recentParserAlert
                  ? `${recentParserAlert.senderLabel} is producing unmatched messages. Latest reason: ${recentParserAlert.failureReason}.`
                  : "No live parser alerts right now. Recent unmatched messages will appear here."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] md:col-span-8">
              <div className="mb-6 flex items-center gap-3">
                <MaterialSymbol className="text-3xl text-primary" name="database" />
                <h3 className="text-xl text-on-surface">Parser Data</h3>
              </div>
              <div className="space-y-4">
                <button
                  className={`flex w-full items-center justify-between rounded-lg border border-outline-variant/20 bg-surface p-4 text-left transition-colors hover:border-primary/30 ${pressableClass}`}
                  onClick={downloadParserPack}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <MaterialSymbol name="upload_file" />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">Export Parser Pack</p>
                      <p className="text-sm text-on-surface-variant">
                        Download templates and parser-control settings.
                      </p>
                    </div>
                  </div>
                  <MaterialSymbol className="text-on-surface-variant" name="chevron_right" />
                </button>
                <button
                  className={`flex w-full items-center justify-between rounded-lg border border-outline-variant/20 bg-surface p-4 text-left transition-colors hover:border-primary/30 ${pressableClass}`}
                  onClick={() => parserPackInputRef.current?.click()}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <MaterialSymbol name="extension" />
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">Import Parser Pack</p>
                      <p className="text-sm text-on-surface-variant">
                        Replace the local parser preview pack from JSON.
                      </p>
                    </div>
                  </div>
                  <MaterialSymbol className="text-on-surface-variant" name="chevron_right" />
                </button>
                <button
                  className={`flex w-full items-center justify-between rounded-lg border border-error/20 bg-error-container/20 p-4 text-left transition-colors hover:bg-error-container/40 ${pressableClass}`}
                  onClick={handlePurgeParserCache}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-error/10 p-3 text-error">
                      <MaterialSymbol name="auto_delete" />
                    </div>
                    <div>
                      <p className="font-bold text-error">Purge Local Cache</p>
                      <p className="text-sm text-on-error-container">
                        Reset local parser templates and temporary preview state.
                      </p>
                    </div>
                  </div>
                  <MaterialSymbol className="text-error" name="warning" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-xl bg-tertiary-fixed p-6 md:col-span-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,124,89,0.16),transparent_40%)]" />
              <div className="relative z-10">
                <p className="font-headline text-2xl font-bold text-on-tertiary-fixed">
                  {driftConfidence}% Health
                </p>
                <p className="mb-4 text-sm text-on-tertiary-fixed-variant">
                  Template coverage, drift, and parser-review queues are within a safe range.
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${driftConfidence}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] md:col-span-6">
              <div className="mb-6 flex items-center gap-3">
                <MaterialSymbol className="text-3xl text-primary" name="verified_user" />
                <h3 className="text-xl text-on-surface">Data Integrity</h3>
              </div>
              <div className="space-y-6">
                {[
                  {
                    label: "Strict Schema Parsing",
                    detail: "Reject any SMS that does not fully match a trusted route.",
                    checked: strictSchemaParsing,
                    onToggle: () => setStrictSchemaParsing((current) => !current),
                  },
                  {
                    label: "Preserve Raw SMS",
                    detail: "Store original SMS text alongside parsed transaction drafts.",
                    checked: preserveRawSms,
                    onToggle: () => setPreserveRawSms((current) => !current),
                  },
                  {
                    label: "Auto-Reconciliation",
                    detail: "Prepare matched messages for later balance reconciliation.",
                    checked: autoReconciliation,
                    onToggle: () => setAutoReconciliation((current) => !current),
                  },
                ].map((toggle) => (
                  <div className="flex items-center justify-between" key={toggle.label}>
                    <div className="flex-1 pr-4">
                      <p className="font-bold text-on-surface">{toggle.label}</p>
                      <p className="text-sm text-on-surface-variant">{toggle.detail}</p>
                    </div>
                    <SwitchButton
                      ariaLabel={toggle.label}
                      checked={toggle.checked}
                      onToggle={toggle.onToggle}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] md:col-span-6">
              <div className="mb-6 flex items-center gap-3">
                <MaterialSymbol className="text-3xl text-primary" name="terminal" />
                <h3 className="text-xl text-on-surface">Logging</h3>
              </div>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-on-surface">Verbose Debug Logging</p>
                    <p className="text-sm text-on-surface-variant">
                      Record granular parsing details for diagnostics and template tuning.
                    </p>
                  </div>
                  <SwitchButton
                    ariaLabel="Verbose Debug Logging"
                    checked={verboseLogging}
                    onToggle={() => setVerboseLogging((current) => !current)}
                  />
                </div>
                <div className="h-px border-t border-outline-variant/20" />
                <button
                  className={`flex w-full items-center justify-between text-left ${pressableClass}`}
                  onClick={() =>
                    showParserStatus(
                      `Latest system snapshot: ${unmatchedMessages.length} parser errors, ${approvalQueue.length} queued drafts, ${activeTemplateCount} active templates.`,
                      "success",
                    )
                  }
                  type="button"
                >
                  <div>
                    <p className="font-bold text-primary">View System Logs</p>
                    <p className="text-sm text-on-surface-variant">
                      Inspect recent parser attempts, queue transfers, and unmatched events.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MaterialSymbol name="open_in_new" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <button
        className={`fixed bottom-28 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95 ${pressableClass}`}
        onClick={() => setIsFocusedEditorOpen(true)}
        type="button"
      >
        <MaterialSymbol className="text-3xl" name="terminal" />
      </button>

      {isTemplateBuilderOpen ? (
        <OverlayPanel
          onClose={() => setIsTemplateBuilderOpen(false)}
          subtitle="Quick mobile creation for emergency parser cases."
          title="Create Template"
        >
          <section className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Sender family
                </span>
                <select
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      sender: event.target.value,
                    }))
                  }
                  value={templateBuilderDraft.sender}
                >
                  {parserSenderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Template name
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.name}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Regex
              </span>
              <textarea
                className="h-32 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 font-mono text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                onChange={(event) =>
                  setTemplateBuilderDraft((current) => ({
                    ...current,
                    regex: event.target.value,
                  }))
                }
                value={templateBuilderDraft.regex}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Direction
                </span>
                <select
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      direction: event.target.value as TransactionDirection,
                    }))
                  }
                  value={templateBuilderDraft.direction}
                >
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Amount key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      amountKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.amountKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Merchant key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      merchantKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.merchantKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Balance key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      balanceKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.balanceKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Fee key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      feeKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.feeKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  VAT key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      vatKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.vatKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Account key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      accountKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.accountKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Reference key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      referenceKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.referenceKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Date key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      dateKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.dateKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Time key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      timeKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.timeKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Meridiem key
                </span>
                <input
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      meridiemKey: event.target.value,
                    }))
                  }
                  type="text"
                  value={templateBuilderDraft.meridiemKey}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">
                  Date mode
                </span>
                <select
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      dateMode: event.target.value as ParserTemplateDateMode,
                    }))
                  }
                  value={templateBuilderDraft.dateMode}
                >
                  <option value="message_date">Use message date</option>
                  <option value="captured_at">Use captured timestamp</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className={`rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
                onClick={() => setIsTemplateBuilderOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary ${pressableClass}`}
                onClick={handleCreateTemplate}
                type="button"
              >
                Create draft template
              </button>
            </div>
          </section>
        </OverlayPanel>
      ) : null}

      {isFocusedEditorOpen ? (
        <OverlayPanel
          onClose={() => setIsFocusedEditorOpen(false)}
          subtitle={selectedTemplate?.note ?? "Focused editor"}
          title={selectedTemplate?.name ?? "Focused editor"}
        >
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusChip icon="rule" tone="success">
                {selectedTemplate?.status ?? "draft"}
              </StatusChip>
              <StatusChip icon="history" tone="neutral">
                {selectedTemplate?.version ?? "v0.0.0"}
              </StatusChip>
              <StatusChip icon="account_balance_wallet" tone="neutral">
                {selectedTemplate?.institutionLabel ?? "Unknown sender"}
              </StatusChip>
            </div>
            {selectedTemplate ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Template name
                  </span>
                  <input
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        name: event.target.value,
                        updated: "Updated just now",
                      }))
                    }
                    type="text"
                    value={selectedTemplate.name}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Status
                  </span>
                  <select
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        status: event.target.value as ParserTemplateStatus,
                        updated: "Updated just now",
                      }))
                    }
                    value={selectedTemplate.status}
                  >
                    <option value="active">Active</option>
                    <option value="fallback">Fallback</option>
                    <option value="draft">Draft</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <label className="block lg:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Note
                  </span>
                  <input
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        note: event.target.value,
                        updated: "Updated just now",
                      }))
                    }
                    type="text"
                    value={selectedTemplate.note}
                  />
                </label>
                <label className="block lg:col-span-2">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Regex
                  </span>
                  <textarea
                    className="h-32 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 font-mono text-sm text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        regex: event.target.value,
                        updated: "Updated just now",
                      }))
                    }
                    value={selectedTemplate.regex}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Direction
                  </span>
                  <select
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        direction: event.target.value as TransactionDirection,
                        note: buildParserTemplateNote({
                          ...template,
                          direction: event.target.value as TransactionDirection,
                        }),
                        updated: "Updated just now",
                      }))
                    }
                    value={selectedTemplate.direction}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Date mode
                  </span>
                  <select
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                    onChange={(event) =>
                      updateSelectedTemplate((template) => ({
                        ...template,
                        dateMode: event.target.value as ParserTemplateDateMode,
                        updated: "Updated just now",
                      }))
                    }
                    value={selectedTemplate.dateMode}
                  >
                    <option value="message_date">Use message date</option>
                    <option value="captured_at">Use captured timestamp</option>
                  </select>
                </label>
                {[
                  ["Amount key", "amountKey"],
                  ["Merchant key", "merchantKey"],
                  ["Balance key", "balanceKey"],
                  ["Fee key", "feeKey"],
                  ["VAT key", "vatKey"],
                  ["Account key", "accountKey"],
                  ["Reference key", "referenceKey"],
                  ["Date key", "dateKey"],
                  ["Time key", "timeKey"],
                  ["Meridiem key", "meridiemKey"],
                ].map(([label, field]) => (
                  <label className="block" key={field}>
                    <span className="mb-2 block text-sm font-semibold text-on-surface">
                      {label}
                    </span>
                    <input
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                      onChange={(event) =>
                        updateSelectedTemplate((template) => {
                          const nextTemplate = {
                            ...template,
                            [field]: event.target.value.trim() || undefined,
                            updated: "Updated just now",
                          } as ParserTemplateDefinition;
                          return {
                            ...nextTemplate,
                            note: buildParserTemplateNote(nextTemplate),
                          };
                        })
                      }
                      type="text"
                      value={(selectedTemplate[field as keyof ParserTemplateDefinition] as string | undefined) ?? ""}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <section className="min-h-[72vh] overflow-hidden rounded-[24px] border border-outline-variant/20 bg-[#2e3230]">
              <pre className="h-full overflow-auto p-5 font-mono text-sm leading-7 text-[#eae6de]">
                <code>{parserSource}</code>
              </pre>
            </section>
          </section>
        </OverlayPanel>
      ) : null}
    </section>
  );
}

function ForwardingPage() {
  const [desktopSyncEnabled, setDesktopSyncEnabled] = useState(true);
  const [peerToPeerEnabled, setPeerToPeerEnabled] = useState(false);
  const [workstationId, setWorkstationId] = useState("WS-TRACK-01");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipients, setRecipients] = useState([
    { id: "recipient-1", name: "Desktop fallback", phone: "+251911000000" },
  ]);
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  function showForwardingStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2200);
  }

  function handleAddRecipient() {
    if (!recipientName.trim() || !recipientPhone.trim()) {
      showForwardingStatus(
        "Add both a recipient name and a trusted phone number before saving.",
        "error",
      );
      return;
    }

    setRecipients((current) => [
      ...current,
      {
        id: `recipient-${current.length + 1}`,
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
      },
    ]);
    setRecipientName("");
    setRecipientPhone("");
    showForwardingStatus("Recipient added to the local forwarding roster.", "success");
  }

  function handleSave() {
    setSaveState("working");
    setTimeout(() => {
      setSaveState("done");
      showForwardingStatus(
        "Forwarding preferences were saved locally and are ready for backend transport wiring.",
        "success",
      );
      setTimeout(() => setSaveState("idle"), 1200);
    }, 700);
  }

  return (
    <section className="space-y-10">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <header className="space-y-2">
        <h2 className="font-headline text-3xl font-bold text-primary">
          Message Routing
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
          Route incoming bank notifications toward your desktop review route
          or a fallback phone path.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="relative overflow-hidden rounded-xl bg-surface p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-bl-full bg-primary/5 transition-transform duration-500" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-primary">
                  <MaterialSymbol className="text-2xl" name="computer" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-on-surface">
                  Desktop Sync
                </h3>
              </div>
              <SwitchButton
                checked={desktopSyncEnabled}
                onToggle={() => setDesktopSyncEnabled((current) => !current)}
              />
            </div>
            <p className="text-sm leading-6 text-on-surface-variant">
              Automatically push incoming SMS into your desktop review route
              when both devices share the same local network.
            </p>
            <div className="space-y-3">
              <label className="ml-1 block text-sm font-semibold text-on-surface">
                Workstation ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-outline">
                  <MaterialSymbol className="text-[20px]" name="tag" />
                </span>
                <input
                  className="w-full rounded-lg border-none bg-surface-container-low py-4 pl-12 pr-4 text-on-surface focus:ring-2 focus:ring-primary"
                  onChange={(event) => setWorkstationId(event.target.value)}
                  type="text"
                  value={workstationId}
                />
              </div>
              <p className="ml-1 text-xs text-secondary">Connected 2 hours ago.</p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-xl bg-surface p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-bl-full bg-tertiary/5 transition-transform duration-500" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-container/30 text-tertiary">
                  <MaterialSymbol className="text-2xl" name="smartphone" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-on-surface">
                  Peer-to-Peer
                </h3>
              </div>
              <SwitchButton
                checked={peerToPeerEnabled}
                onToggle={() => setPeerToPeerEnabled((current) => !current)}
              />
            </div>
            <p className="text-sm leading-6 text-on-surface-variant">
              Relay raw SMS data to another trusted mobile number as a fallback
              or shared-review path.
            </p>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 ml-1 block text-sm font-semibold text-on-surface">
                    Recipient name
                  </span>
                  <input
                    aria-label="Recipient name"
                    className="w-full rounded-lg border-none bg-surface-container-low px-4 py-4 text-on-surface focus:ring-2 focus:ring-primary"
                    onChange={(event) => setRecipientName(event.target.value)}
                    type="text"
                    value={recipientName}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 ml-1 block text-sm font-semibold text-on-surface">
                    Recipient phone
                  </span>
                  <input
                    aria-label="Recipient phone"
                    className="w-full rounded-lg border-none bg-surface-container-low px-4 py-4 text-on-surface focus:ring-2 focus:ring-primary"
                    onChange={(event) => setRecipientPhone(event.target.value)}
                    type="text"
                    value={recipientPhone}
                  />
                </label>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-primary"
                onClick={handleAddRecipient}
                type="button"
              >
                <MaterialSymbol filled name="person_add" />
                Add recipient
              </button>
              <div className="space-y-3">
                {recipients.map((recipient) => (
                  <div
                    className="flex items-center justify-between rounded-2xl bg-surface-container-low p-4"
                    key={recipient.id}
                  >
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {recipient.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {recipient.phone}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Trusted
                    </span>
                  </div>
                ))}
              </div>
              <p className="ml-1 text-xs text-secondary">
                Requires re-authentication to modify once backend transport is
                enabled.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-surface-variant pt-4">
        <ActionStatusButton
          actionState={saveState}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-on-primary md:w-auto"
          doneLabel="Saved"
          idleLabel="Save Configuration"
          onClick={handleSave}
          workingLabel="Saving..."
        />
      </div>
    </section>
  );
}

function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeGuide, setActiveGuide] = useState<HelpCategoryCard | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = helpCategoryCards.filter((item) =>
    [
      item.title,
      item.detail,
      ...item.sections.flatMap((section) => [
        section.title,
        section.body,
        ...(section.bullets ?? []),
      ]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );

  const filteredFaqs = helpFeaturedFaqs.filter((item) =>
    `${item.question} ${item.summary} ${item.answer} ${item.tag}`
      .toLowerCase()
      .includes(normalizedQuery),
  );

  return (
    <section className="space-y-12">
      <MotionPanel className="mx-auto max-w-2xl space-y-6 text-center">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <MaterialSymbol className="text-outline" name="search" />
          </div>
          <input
            className="w-full rounded-xl bg-surface-container-lowest py-4 pl-12 pr-4 text-lg text-on-surface shadow-sm focus:border-primary focus:ring-2 focus:ring-primary"
            placeholder="Search guides, tutorials, and rules..."
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            value={query}
          />
        </div>
      </MotionPanel>

      <MotionPanel className="space-y-5" delay={40}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-background">
              Track Wallet Help Center
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Each section stays in-app and calls out where the mobile build is
              fully live versus still staged.
            </p>
          </div>
          <StatusChip icon="lock_clock" tone="neutral">
            No external site required
          </StatusChip>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((item) => (
            <button
              className={`rounded-[24px] border border-outline-variant/20 bg-surface-container p-6 text-left shadow-[0_4px_18px_rgba(46,50,48,0.05)] hover:bg-surface-container-high ${pressableClass}`}
              key={item.title}
              onClick={() => setActiveGuide(item)}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${item.tone}`}
                >
                  <MaterialSymbol name={item.icon} />
                </div>
                <StatusChip tone="neutral">{item.statusLabel}</StatusChip>
              </div>
              <h4 className="mt-4 font-headline text-lg font-bold text-on-background">
                {item.title}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                {item.detail}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  {item.sections.length} sections
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Open guide
                  <MaterialSymbol className="text-[18px]" name="arrow_forward" />
                </span>
              </div>
            </button>
          ))}
          {filteredCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant sm:col-span-2 xl:col-span-3">
              No documentation category matches that search yet. Try SMS,
              parser, security, or devices.
            </div>
          ) : null}
        </div>
      </MotionPanel>

      <MotionPanel className="space-y-6" delay={90}>
        <h3 className="font-headline text-xl font-bold text-on-background">
          Featured Articles
        </h3>
        <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          {filteredFaqs.map((item) => {
            const isExpanded = expandedFaqId === item.id;

            return (
              <article
                className="border-b border-outline-variant/20 p-5 last:border-b-0"
                key={item.id}
              >
                <button
                  className={`flex w-full items-center gap-4 text-left ${pressableClass}`}
                  onClick={() =>
                    setExpandedFaqId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  type="button"
                >
                  <div className="rounded-lg bg-surface-container-highest p-2 text-secondary">
                    <MaterialSymbol name="article" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-2">
                      <StatusChip tone="neutral">{item.tag}</StatusChip>
                    </div>
                    <h4 className="font-headline font-semibold text-on-background">
                      {item.question}
                    </h4>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {item.summary}
                    </p>
                  </div>
                  <MaterialSymbol
                    className={`text-outline-variant transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    name="chevron_right"
                  />
                </button>
                {isExpanded ? (
                  <div className="ml-14 mt-4 rounded-2xl bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
                    {item.answer}
                  </div>
                ) : null}
              </article>
            );
          })}
          {filteredFaqs.length === 0 ? (
            <div className="p-5 text-sm text-on-surface-variant">
              No matching guidance yet. Try searching for SMS, Inbox, Sync, or
              trusted devices.
            </div>
          ) : null}
        </div>
      </MotionPanel>

      {activeGuide ? (
        <OverlayPanel
          onClose={() => setActiveGuide(null)}
          subtitle={activeGuide.detail}
          title={activeGuide.title}
        >
          <div className="mb-5 flex items-center justify-between gap-3 rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5">
            <div>
              <p className="text-sm font-semibold text-on-surface">
                Guide readiness
              </p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                This guide marks which sections are fully available in the
                mobile app and which deeper flows still depend on backend or
                native wiring.
              </p>
            </div>
            <StatusChip icon="task_alt" tone="neutral">
              {activeGuide.statusLabel}
            </StatusChip>
          </div>
          <div className="grid gap-4">
            {activeGuide.sections.map((section, index) => {
              const isComingSoon = section.availability === "coming-soon";

              return (
                <MotionPanel
                  className="rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5"
                  delay={index * 60}
                  key={section.title}
                  variant="subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-headline text-xl font-semibold text-on-surface">
                      {section.title}
                    </h4>
                    <StatusChip
                      icon={isComingSoon ? "schedule" : "check_circle"}
                      tone={isComingSoon ? "warning" : "success"}
                    >
                      {isComingSoon ? "Coming soon" : "Available now"}
                    </StatusChip>
                  </div>
                  <div className={isComingSoon ? "relative mt-3 overflow-hidden rounded-[20px]" : "mt-3"}>
                    <div
                      className={
                        isComingSoon
                          ? "rounded-[20px] bg-surface p-4 blur-[3px] opacity-45 select-none"
                          : "rounded-[20px] bg-surface p-4"
                      }
                    >
                      <p className="text-sm leading-6 text-on-surface-variant">
                        {section.body}
                      </p>
                      {section.bullets?.length ? (
                        <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                          {section.bullets.map((bullet) => (
                            <li className="flex items-start gap-2" key={bullet}>
                              <MaterialSymbol
                                className="mt-0.5 text-[16px] text-primary"
                                filled
                                name="check_circle"
                              />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {isComingSoon ? (
                      <div className="absolute inset-0 flex flex-col items-start justify-end bg-[linear-gradient(180deg,rgba(248,245,239,0.1),rgba(248,245,239,0.92))] p-4">
                        <StatusChip icon="schedule" tone="warning">
                          Coming soon
                        </StatusChip>
                        <p className="mt-3 text-sm leading-6 text-on-surface">
                          {section.previewNote}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </MotionPanel>
              );
            })}
          </div>
        </OverlayPanel>
      ) : null}
    </section>
  );
}

function ConnectDevicePage({
  onOpenPage,
}: {
  onOpenPage: (pageId: SettingsPageId) => void;
}) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <MotionPanel className="space-y-2">
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Device pairing is hidden in this alpha
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          Discovery and sync status stay visible. QR and code pairing stay off
          until Android transport is ready.
        </p>
      </MotionPanel>

      <MotionPanel className="rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-tertiary">
            <MaterialSymbol className="text-[28px]" filled name="devices" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-on-surface">
              What you can do right now
            </p>
            <p className="text-sm leading-6 text-on-surface-variant">
              Use Sync to inspect discovery, trusted devices, and manual
              refresh.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface px-5 py-3 text-sm font-semibold text-primary transition active:scale-[0.99]"
            onClick={() => onOpenPage("sync")}
            type="button"
          >
            Back to Sync
          </button>
        </div>
      </MotionPanel>
    </section>
  );
}

function AdvancedBoundaryPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <MotionPanel className="space-y-2">
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Advanced controls are hidden in this alpha
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          API keys, webhooks, and experimental runtime controls stay hidden
          until they have real mobile backing.
        </p>
      </MotionPanel>

      <MotionPanel className="rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface-variant">
            <MaterialSymbol className="text-[28px]" filled name="settings_suggest" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-on-surface">
              Hidden until backed by real product state
            </p>
            <p className="text-sm leading-6 text-on-surface-variant">
              This includes trust or pairing secrets, webhook endpoints, API
              keys, parser-debug purges, and similar controls that would
              otherwise look live but still be preview-only.
            </p>
          </div>
        </div>
      </MotionPanel>
    </section>
  );
}

function SyncPage({
  onOpenPage,
}: {
  onOpenPage: (pageId: SettingsPageId) => void;
}) {
  const syncEnabled = useTransactionStore((state) => state.syncEnabled);
  const syncMode = useTransactionStore((state) => state.syncMode);
  const syncDiscoveryState = useTransactionStore(
    (state) => state.syncDiscoveryState,
  );
  const syncStatusSummary = useTransactionStore((state) => state.syncStatusSummary);
  const nearbySyncDevices = useTransactionStore((state) => state.nearbySyncDevices);
  const trustedSyncDevices = useTransactionStore(
    (state) => state.trustedSyncDevices,
  );
  const syncActivity = useTransactionStore((state) => state.syncActivity);

  const primaryTrustedDevice =
    trustedSyncDevices.find((device) => device.isPrimary) ??
    trustedSyncDevices[0] ??
    null;
  const latestSync =
    syncActivity.find((entry) => entry.type === "sync") ?? null;
  const recentSyncActivity = syncActivity.slice(0, 5);

  return (
    <section className="space-y-8">
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-headline text-3xl font-bold text-on-surface md:text-4xl">
            Sync &amp; Devices
          </h2>
          <StatusChip icon="visibility" tone="warning">
            Local preview only
          </StatusChip>
        </div>
        <p className="mt-2 text-lg text-on-surface-variant">
          Transport-backed sync is not active in this alpha. This page stays
          read-only so the app stops pretending local preview arrays are a real
          network path.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-xl bg-surface-container p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-2">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="flex items-center gap-3 font-headline text-2xl text-on-surface">
                <MaterialSymbol className="text-3xl text-primary" name="dns" />
                Primary Route
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                  syncEnabled
                    ? "bg-green-100 text-green-800"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    syncEnabled ? "animate-pulse bg-[#22c55e]" : "bg-outline"
                  }`}
                />
                {syncEnabled ? "Synced" : "Paused"}
              </span>
            </div>

            <div className="mb-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/30 bg-surface p-5">
                <p className="text-sm text-on-surface-variant">Nearby ready</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-headline text-3xl text-on-surface">
                    {syncStatusSummary.nearbyReadyCount}
                  </span>
                  <span className="text-sm text-on-surface-variant">devices</span>
                </div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-surface-variant">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(12, syncStatusSummary.nearbyReadyCount * 24),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-outline-variant/30 bg-surface p-5">
                <p className="text-sm text-on-surface-variant">Last sync</p>
                <div className="mt-1 font-headline text-2xl text-on-surface">
                  {latestSync ? formatShortDate(latestSync.occurredAt) : "Not yet"}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {latestSync
                    ? latestSync.detail
                    : "Run your first trusted sync to populate history."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
              <div className="flex items-center gap-3">
                <MaterialSymbol className="text-on-surface-variant" name="language" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {primaryTrustedDevice?.displayName ?? "No primary route yet"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {primaryTrustedDevice
                      ? `${formatPlatformLabel(primaryTrustedDevice.platform)} • ${sanitizeAlphaSyncCopy(syncStatusSummary.headline)}`
                      : "No transport-backed primary path exists yet on this phone."}
                  </p>
                </div>
              </div>
              <StatusChip icon="sync_disabled" tone="warning">
                Transport pending
              </StatusChip>
            </div>

            <div className="mt-6 rounded-[24px] border border-tertiary/20 bg-tertiary-container/25 p-5">
              <div className="flex items-start gap-3">
                <MaterialSymbol
                  className="mt-0.5 text-[20px] text-tertiary"
                  filled
                  name="info"
                />
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    Pairing stays hidden in this alpha
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    The phone can show locally stored preview status, but QR
                    pairing, manual device codes, discovery toggles, and
                    trust-changing actions stay hidden until the Android
                    transport and verification flow are fully backed.
                  </p>
                  <button
                    className="mt-4 rounded-lg border border-outline-variant/24 bg-surface px-4 py-2 text-sm font-semibold text-primary"
                    onClick={() => onOpenPage("connect-device")}
                    type="button"
                  >
                    Why pairing is hidden
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-xl border border-tertiary/10 bg-tertiary-container/10 p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div>
            <h3 className="font-headline text-xl text-on-surface">
              Network Health
            </h3>
            <p className="mb-6 mt-2 text-sm text-on-surface-variant">
              Overall posture from the routes and status already stored on this
              phone.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface">Trusted devices</span>
                <span className="text-sm font-semibold text-on-surface">
                  {trustedSyncDevices.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface">Mode</span>
                <span className="text-sm font-semibold text-on-surface">
                  {syncMode === "automatic" ? "Automatic" : "Manual"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface">Discovery</span>
                <span className="text-sm font-semibold text-on-surface">
                  {syncDiscoveryState === "searching" ? "Scanning" : "Idle"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-xl border border-outline-variant/20 bg-surface p-4 text-sm leading-6 text-on-surface-variant">
            Sync enabled, mode, discovery, and refresh remain read-only until
            the transport lane exists. Use this surface to inspect posture, not
            to drive local simulator state.
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-surface-container p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-3">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-3 font-headline text-2xl text-on-surface">
                <MaterialSymbol className="text-3xl text-tertiary" name="devices" />
                Connected Devices
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Read-only visibility into locally stored trusted-route previews
                and discovered-device placeholders.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {trustedSyncDevices.map((device) => (
              <article
                className="flex items-start gap-5 rounded-xl border border-outline-variant/30 bg-surface p-6"
                key={device.deviceId}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-container">
                  <MaterialSymbol
                    className="text-2xl text-on-surface"
                    name={materialForDevice(device)}
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="font-headline text-lg text-on-surface">
                      {device.displayName}
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {device.health === "healthy" ? "Connected" : "Attention"}
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-on-surface-variant">
                    {formatPlatformLabel(device.platform)} • Last sync{" "}
                    {formatShortDateTime(device.lastSyncedAt)}
                  </p>
                  <div className="flex gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      <MaterialSymbol className="text-[18px]" filled name="check" />
                      {device.isPrimary ? "Primary route" : "Trusted"}
                    </span>
                  </div>
                </div>
              </article>
            ))}

            {nearbySyncDevices.map((device) => (
              <article
                className="flex items-start gap-5 rounded-xl border border-outline-variant/30 bg-surface p-6 opacity-80"
                key={device.deviceId}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-container">
                  <MaterialSymbol
                    className="text-2xl text-on-surface"
                    name={materialForDevice(device)}
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="font-headline text-lg text-on-surface">
                      {device.displayName}
                    </h4>
                    <span className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                      <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                      Nearby
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-on-surface-variant">
                    {formatPlatformLabel(device.platform)} • {device.statusLabel}
                  </p>
                  <div className="flex gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                      <MaterialSymbol className="text-[18px]" name="visibility" />
                      Visible only
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {trustedSyncDevices.length === 0 && nearbySyncDevices.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
              No preview devices are stored on this phone yet.
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                Recent sync activity
              </h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Preview events already stored on this phone.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentSyncActivity.length > 0 ? (
              recentSyncActivity.map((entry) => (
                <article
                  className="rounded-2xl bg-surface p-4"
                  key={entry.activityId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {sanitizeAlphaSyncCopy(entry.title)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        {sanitizeAlphaSyncCopy(entry.detail)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        entry.status === "success"
                          ? "bg-primary/10 text-primary"
                          : entry.status === "warning"
                            ? "bg-tertiary/10 text-tertiary"
                            : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {formatShortDateTime(entry.occurredAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
                Sync activity will appear here once a real transport-backed lane
                writes events into the local authority.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function AdvancedPage() {
  const [strictSchema, setStrictSchema] = useState(true);
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [aiCategorization, setAiCategorization] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState(
    "https://internal.trackwallet.local/events/mobile",
  );
  const [saveState, setSaveState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);

  function showAdvancedStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2400);
  }

  function handleSave() {
    setSaveState("working");
    setTimeout(() => {
      setSaveState("done");
      showAdvancedStatus(
        "Advanced runtime preferences were saved locally on this device.",
        "success",
      );
      setTimeout(() => setSaveState("idle"), 1200);
    }, 700);
  }

  return (
    <section className="space-y-8">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <header className="space-y-2">
        <h2 className="font-headline text-3xl font-bold text-on-surface">
          Advanced Settings
        </h2>
        <p className="text-sm text-on-surface-variant">
          Technical configurations and system-level behavior for the mobile
          workspace.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 md:p-8 lg:col-span-12">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 font-headline text-xl font-semibold text-on-surface">
                <MaterialSymbol className="text-primary" filled name="key" />
                API Keys
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage programmatic access to your mobile vault instance.
              </p>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              onClick={() =>
                showAdvancedStatus(
                  "Key issuance still belongs to the backend authority pass. This UI now records the action request honestly instead of pretending to mint one.",
                  "warning",
                )
              }
              type="button"
            >
              <MaterialSymbol className="text-sm" name="add" />
              Generate New Key
            </button>
          </div>
          <div className="space-y-4">
            {[
              {
                label: "Vault Authority",
                key: "track_live_pk_9xj2........................8v4n",
                meta: "Created today • Used on local device",
                muted: false,
              },
              {
                label: "Sandbox Parser",
                key: "track_test_pk_4a7c........................3f1p",
                meta: "Created for staging • Not yet used",
                muted: true,
              },
            ].map((item) => (
              <div
                className={`flex flex-col gap-4 rounded-lg border border-outline-variant/20 bg-surface-container p-4 md:flex-row md:items-center md:justify-between ${
                  item.muted ? "opacity-75" : ""
                }`}
                key={item.label}
              >
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-on-surface">
                    {item.label}
                  </h4>
                  <div className="mt-1 overflow-x-auto rounded bg-surface px-2 py-1 font-mono text-xs text-on-surface-variant">
                    {item.key}
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {item.meta}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full p-2 text-secondary hover:bg-surface-variant"
                    onClick={() =>
                      showAdvancedStatus(
                        `Copied preview key label for ${item.label}. Real secret copying belongs to backend-issued keys only.`,
                        "warning",
                      )
                    }
                    type="button"
                  >
                    <MaterialSymbol className="text-sm" name="content_copy" />
                  </button>
                  <button
                    className="rounded-full p-2 text-error hover:bg-error/10"
                    onClick={() =>
                      showAdvancedStatus(
                        `Revocation is staged for ${item.label}. Real key revocation needs authority-backed issuance first.`,
                        "warning",
                      )
                    }
                    type="button"
                  >
                    <MaterialSymbol className="text-sm" name="delete" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 md:p-8 lg:col-span-7">
          <div className="mb-6">
            <h3 className="flex items-center gap-2 font-headline text-xl font-semibold text-on-surface">
              <MaterialSymbol className="text-primary" name="webhook" />
              Webhook Endpoints
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Configure where Track Wallet sends real-time event notifications.
            </p>
          </div>
          <div className="flex-1 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Endpoint URL
              </span>
              <input
                className="w-full rounded-lg border border-outline-variant/50 bg-surface px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                onChange={(event) => setWebhookUrl(event.target.value)}
                type="url"
                value={webhookUrl}
              />
            </label>
            <div>
              <span className="mb-3 block text-sm font-semibold text-on-surface">
                Events to send
              </span>
              <div className="space-y-3 rounded-lg border border-outline-variant/20 bg-surface-container p-4">
                {[
                  "Transaction Approved",
                  "Sync Completed",
                  "Parser Warning",
                ].map((eventLabel, index) => (
                  <label className="flex items-start gap-3" key={eventLabel}>
                    <input
                      className="mt-1 h-4 w-4 rounded border-outline text-primary focus:ring-primary"
                      defaultChecked={index < 2}
                      type="checkbox"
                    />
                    <div>
                      <span className="text-sm font-semibold text-on-surface">
                        {eventLabel}
                      </span>
                      <p className="text-xs text-on-surface-variant">
                        Deliver this event to the configured endpoint.
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <ActionStatusButton
                actionState={saveState}
                className="rounded-lg border border-primary/20 bg-surface px-6 py-2 text-sm font-semibold text-primary"
                doneLabel="Saved"
                idleLabel="Save Configuration"
                onClick={handleSave}
                workingLabel="Saving..."
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 md:p-8">
            <h3 className="mb-6 flex items-center gap-2 font-headline text-xl font-semibold text-on-surface">
              <MaterialSymbol className="text-primary" name="toggle_on" />
              System Behavior
            </h3>
            <div className="space-y-6">
              {[
                {
                  id: "strict-schema",
                  label: "Strict Schema Parsing",
                  detail:
                    "Reject entries with missing non-critical fields.",
                  checked: strictSchema,
                  onToggle: () => setStrictSchema((current) => !current),
                  disabled: false,
                },
                {
                  id: "verbose-logging",
                  label: "Verbose Logging",
                  detail: "Store detailed debug info for parser events.",
                  checked: verboseLogging,
                  onToggle: () => setVerboseLogging((current) => !current),
                  disabled: false,
                },
                {
                  id: "ai-categorization",
                  label: "AI Categorization",
                  detail: "Preview only until backend model routing exists.",
                  checked: aiCategorization,
                  onToggle: () => setAiCategorization((current) => !current),
                  disabled: true,
                },
              ].map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-on-surface">
                        {item.label}
                      </label>
                      <span className="text-xs text-on-surface-variant">
                        {item.detail}
                      </span>
                    </div>
                    <SwitchButton
                      ariaLabel={item.label}
                      checked={item.checked}
                      disabled={item.disabled}
                      onToggle={item.onToggle}
                    />
                  </div>
                  {index < 2 ? (
                    <div className="mt-6 h-px w-full bg-outline-variant/20" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-error/20 bg-error-container/20 p-6">
            <h3 className="mb-2 flex items-center gap-2 font-headline text-lg font-semibold text-error">
              <MaterialSymbol className="text-error" name="warning" />
              Danger Zone
            </h3>
            <p className="mb-4 text-sm text-on-surface-variant">
              Actions here are irreversible and may affect local mobile state.
            </p>
            <div className="flex flex-col gap-4 rounded-lg border border-error/10 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-on-surface">
                  Purge Parser Cache
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Clears saved template hints and debug surfaces on this device.
                </p>
              </div>
              <button
                className="whitespace-nowrap rounded-lg border border-error/20 bg-error/10 px-4 py-2 text-sm font-semibold text-error"
                onClick={() =>
                  showAdvancedStatus(
                    "Cache purge stays blocked until it can target diagnostics without clearing live finance data.",
                    "warning",
                  )
                }
                type="button"
              >
                Purge Cache
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export function SettingsDetailScreen({
  pageId,
  onOpenPage = () => undefined,
  onOpenTab = () => undefined,
  orderedAccountIds = [],
  demoModeEnabled = readDemoModeEnabled(),
  onRequestEnableDemoMode = () => undefined,
}: SettingsDetailScreenProps) {
  let page: ReactNode;

  switch (pageId) {
    case "account":
      page = <ManageAccountPage />;
      break;
    case "appearance":
      page = (
        <AppearancePage
          demoModeEnabled={demoModeEnabled}
          onRequestEnableDemoMode={onRequestEnableDemoMode}
          orderedAccountIds={orderedAccountIds}
        />
      );
      break;
    case "security":
      page = <SecurityPage />;
      break;
    case "dataStorage":
      page = <DataStoragePage />;
      break;
    case "parsing":
      page = <ParsingWorkspacePage onOpenTab={onOpenTab} />;
      break;
    case "forwarding":
      page = <SmsCaptureRoutingPage />;
      break;
    case "help":
      page = <HelpPage />;
      break;
    case "connect-device":
      page = <ConnectDevicePage onOpenPage={onOpenPage} />;
      break;
    case "sync":
      page = <SyncPage onOpenPage={onOpenPage} />;
      break;
    case "advanced":
    default:
      page = <AdvancedBoundaryPage />;
  }

  return (
    <>
      <SettingsMotionStyles />
      <MotionPage className="space-y-0" key={pageId}>
        {page}
      </MotionPage>
    </>
  );
}
