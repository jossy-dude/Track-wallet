import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  FINANCIAL_INSTITUTION_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  type NearbySyncDevice,
} from "@omni-sync/core";
import { transactionStore, useTransactionStore } from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPanel,
  SettingsMotionStyles,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import { useParser } from "../hooks/useParser";
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
  helpCategoryCards,
  helpFeaturedFaqs,
  type HelpCategoryCard,
} from "./settingsHelpContent";
import { DataStoragePage } from "./DataStoragePage";
import { type SettingsPageId } from "./settingsHubContent";

type AppTabId = "home" | "inbox" | "ledger" | "accounts";

interface SettingsDetailScreenProps {
  pageId: SettingsPageId;
  onOpenPage?: (pageId: SettingsPageId) => void;
  onOpenTab?: (tabId: AppTabId) => void;
  orderedAccountIds?: readonly string[];
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
  { value: "CBE", label: "CBE" },
  { value: "DashenBank", label: "Dashen Bank" },
  { value: "127", label: "Telebirr" },
  { value: "BOA", label: "BOA" },
  { value: "BunnaBank", label: "Bunna Bank" },
] as const;

const parserSandboxFallbackSamples: Record<string, string> = {
  CBE: "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
  DashenBank:
    "Dashen Alert: ETB 1,250.00 debited from account 7788 on 2026-04-28 at FUEL STATION. Available balance ETB 19,880.00",
  127: "Telebirr: ETB 320.00 paid to COFFEE SHOP from wallet 0172 on 2026-04-28. Current balance ETB 1,880.00",
  BOA: "BOA ALERT: ETB 980.00 credited to account 2104 on 2026-04-27 from CLIENT PAYMENT. Bal ETB 15,420.00",
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
  const defaultProfileNote = "Local-first finance workspace owner";
  const [displayName, setDisplayName] = useState("Jossy");
  const [profileNote, setProfileNote] = useState(defaultProfileNote);
  const [hideBalances, setHideBalances] = useState(true);
  const [blurNotifications, setBlurNotifications] = useState(true);
  const [requireExportReview, setRequireExportReview] = useState(true);
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
    setSaveState("working");
    setTimeout(() => {
      setSaveState("done");
      showAccountStatus(
        "Account preferences were saved locally on this phone.",
        "success",
      );
      setTimeout(() => setSaveState("idle"), 1200);
    }, 700);
  }

  function handleResetProfile() {
    setDisplayName("Jossy");
    setProfileNote(defaultProfileNote);
    setHideBalances(true);
    setBlurNotifications(true);
    setRequireExportReview(true);
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
          Manage Account
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          Update your identity, profile image, and privacy controls for this
          mobile workspace.
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
                Profile photo stays local to this device until sync identity is
                backed by the authority layer.
              </p>
            </div>
          </div>
          <button
            className={`rounded-2xl border border-outline-variant/40 bg-surface px-4 py-3 text-sm font-semibold text-primary ${pressableClass}`}
            onClick={() =>
              showAccountStatus(
                "Native photo picking lands in the device integration pass. The profile shell is ready for it.",
                "warning",
              )
            }
            type="button"
          >
            Choose profile image
          </button>
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
              Your profile should describe the person approving transactions on
              this device. Keep names and images grounded so sync/device trust
              screens stay understandable later.
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
                  label: "Hide balance figures in app switcher",
                  checked: hideBalances,
                  onToggle: () => setHideBalances((current) => !current),
                },
                {
                  label: "Blur notifications on lock screen",
                  checked: blurNotifications,
                  onToggle: () => setBlurNotifications((current) => !current),
                },
                {
                  label: "Require review before exporting data",
                  checked: requireExportReview,
                  onToggle: () =>
                    setRequireExportReview((current) => !current),
                },
              ].map((item) => (
                <div className="flex items-center justify-between" key={item.label}>
                  <span className="text-sm text-on-surface">{item.label}</span>
                  <SwitchButton
                    ariaLabel={item.label}
                    checked={item.checked}
                    onToggle={item.onToggle}
                  />
                </div>
              ))}
            </div>
          </div>
          <button
            className={`w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
            onClick={() =>
              showAccountStatus(
                "Profile export is staged as a local action until backend export packaging is wired.",
                "warning",
              )
            }
            type="button"
          >
            Export personal data
          </button>
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
        idleLabel="Save account settings"
        onClick={handleSave}
        workingLabel="Saving..."
      />
    </section>
  );
}

function AppearancePage({
  orderedAccountIds = [],
}: {
  orderedAccountIds?: readonly string[];
}) {
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [fontScale, setFontScale] = useState("3");
  const [density, setDensity] = useState<"compact" | "balanced" | "spaced">(
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
  const [selectedAccent, setSelectedAccent] = useState("forest");
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
          "Appearance preferences were saved locally on this device and Home updated immediately.",
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
          Tune the visual language of Track Wallet across light, dense, and
          calm viewing modes.
        </p>
      </MotionPanel>

      <MotionPanel className="space-y-4" delay={40}>
        <h3 className="font-headline text-2xl font-semibold text-on-surface">
          Theme
        </h3>
        <p className="text-sm text-on-surface-variant">
          Select how the app looks across your devices.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {([
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
            { id: "system", label: "System" },
          ] as const).map((option) => (
            <button
              aria-pressed={theme === option.id}
              className={`group flex flex-col items-center gap-4 rounded-xl p-1 text-left transition ${pressableClass}`}
              key={option.id}
              onClick={() => setTheme(option.id)}
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
        <h3 className="font-headline text-2xl font-semibold text-on-surface">
          Color Accent
        </h3>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            {appearanceAccents.map((accent) => (
              <button
                aria-pressed={selectedAccent === accent.id}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                  accent.color
                } ${pressableClass} ${
                  selectedAccent === accent.id
                    ? "ring-4 ring-primary-container/40 ring-offset-2 ring-offset-surface-container-low"
                    : ""
                }`}
                key={accent.id}
                onClick={() => setSelectedAccent(accent.id)}
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
                  onClick={() => setBottomNavStyle(option.id)}
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
            <h3 className="font-headline text-xl font-semibold text-on-surface">
              Typography
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Adjust the text size for reading comfort.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-4">
            <MaterialSymbol className="text-sm text-on-surface-variant" name="format_size" />
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-variant accent-primary"
              max="5"
              min="1"
              onChange={(event) => setFontScale(event.target.value)}
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
            <h3 className="font-headline text-xl font-semibold text-on-surface">
              Layout Density
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Choose how much space surrounds content.
            </p>
          </div>
          <div className="mt-6 flex overflow-hidden rounded-lg border border-outline-variant/40 bg-surface">
            {(["compact", "balanced", "spaced"] as const).map((option) => (
              <button
                aria-pressed={density === option}
                className={`flex-1 py-3 text-sm font-medium capitalize ${pressableClass} ${
                  density === option
                    ? "bg-primary-container/20 font-semibold text-primary"
                    : "text-on-surface-variant"
                }`}
                key={option}
                onClick={() => setDensity(option)}
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
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [requireBiometricOnOpen, setRequireBiometricOnOpen] = useState(true);
  const [requireBiometricOnApprove, setRequireBiometricOnApprove] = useState(true);
  const [requireBiometricOnDelete, setRequireBiometricOnDelete] = useState(true);
  const [requireBiometricOnForwarding, setRequireBiometricOnForwarding] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [saveState, setSaveState] = useState<ActionState>("idle");
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

  function handleSave() {
    setSaveState("working");
    setTimeout(() => {
      setSaveState("done");
      showSecurityStatus(
        "Security preferences were saved locally on this device.",
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
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Security &amp; Privacy
        </h2>
        <p className="text-sm leading-6 text-on-surface-variant">
          Manage how you protect and access your Track Wallet workspace.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                <MaterialSymbol className="text-lg" filled name="fingerprint" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  Biometric Login
                </h3>
                <p className="mb-3 mt-1 text-sm text-on-surface-variant">
                  Use your device biometrics for secure, fast unlock.
                </p>
                <button
                  className="rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-1.5 text-sm font-semibold text-primary"
                  onClick={() => setIsBiometricsPanelOpen(true)}
                  type="button"
                >
                  Configure Biometrics
                </button>
              </div>
            </div>
            <SwitchButton
              checked={biometricsEnabled}
              onToggle={() => setBiometricsEnabled((current) => !current)}
            />
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
                  Require a second step when a new device signs into your
                  mobile workspace.
                </p>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-surface-container-low px-2 py-1 text-xs text-on-surface-variant">
                  <MaterialSymbol className="text-[14px]" name="verified_user" />
                  Authenticator path configured
                </div>
              </div>
            </div>
            <SwitchButton
              checked={twoFactorEnabled}
              onToggle={() => setTwoFactorEnabled((current) => !current)}
            />
          </article>
        </div>

        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface">
          <div className="border-b border-outline-variant/20 bg-surface-container-lowest p-3">
            <h3 className="flex items-center gap-2 font-headline text-base font-semibold text-on-surface">
              <MaterialSymbol className="text-lg text-primary" name="devices" />
              Active Devices
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
                {!device.current ? (
                  <button
                    className="rounded bg-error/10 px-2 py-1 text-xs font-semibold text-error transition"
                    onClick={() =>
                      showSecurityStatus(
                        "Trusted-device revocation will be fully backed by the authority layer in the backend pass.",
                      )
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-outline-variant/20 bg-surface-container-low p-3">
            <button
              className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-primary hover:underline"
              onClick={() =>
                showSecurityStatus(
                  "Bulk sign-out will become live once trusted-device auth is connected end to end.",
                )
              }
              type="button"
            >
              Sign out of all devices
              <MaterialSymbol className="text-sm" name="logout" />
            </button>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <ActionStatusButton
          actionState={saveState}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          doneLabel="Saved"
          idleLabel="Save Changes"
          onClick={handleSave}
          workingLabel="Saving..."
        />
      </div>

      {isBiometricsPanelOpen ? (
        <OverlayPanel
          onClose={() => setIsBiometricsPanelOpen(false)}
          subtitle="Review how this device should use biometric unlock before sensitive finance screens open."
          title="Biometric unlock setup"
        >
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4 rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5">
              <div className="space-y-3">
                {[
                  {
                    label: "Require biometrics to open Track Wallet",
                    detail:
                      "Protect the approval inbox and account balances when someone else picks up your phone.",
                    checked: requireBiometricOnOpen,
                    onToggle: () =>
                      setRequireBiometricOnOpen((current) => !current),
                  },
                  {
                    label: "Require biometrics before approval",
                    detail:
                      "Gate Inbox approval so posted ledger entries need your fingerprint or face unlock.",
                    checked: requireBiometricOnApprove,
                    onToggle: () =>
                      setRequireBiometricOnApprove((current) => !current),
                  },
                  {
                    label: "Require biometrics before delete",
                    detail:
                      "Use an extra check before removing manual or reviewed transactions.",
                    checked: requireBiometricOnDelete,
                    onToggle: () =>
                      setRequireBiometricOnDelete((current) => !current),
                  },
                  {
                    label: "Require biometrics for forwarding changes",
                    detail:
                      "Lock recipient and routing edits behind biometrics.",
                    checked: requireBiometricOnForwarding,
                    onToggle: () =>
                      setRequireBiometricOnForwarding((current) => !current),
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
                      </div>
                      <SwitchButton
                        checked={rule.checked}
                        onToggle={rule.onToggle}
                      />
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
                This screen saves local preference intent now. The backend pass
                still needs real OS biometric capability checks and secure
                confirmation flows before this can be treated as production
                security.
              </p>
              <div className="mt-5 flex justify-end">
                <ActionStatusButton
                  actionState={saveState}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-on-primary"
                  doneLabel="Saved"
                  idleLabel="Apply biometric rule"
                  onClick={handleSave}
                  workingLabel="Applying..."
                />
              </div>
            </section>
          </div>
        </OverlayPanel>
      ) : null}
    </section>
  );
}

function ParsingPage({ onOpenTab }: { onOpenTab: (tabId: AppTabId) => void }) {
  type ParserWorkspaceTab = "templates" | "sandbox" | "diagnostics";
  type ParserTemplateStatus = "active" | "draft" | "fallback" | "disabled";
  interface ParserTemplateCard {
    id: string;
    institutionKey: string;
    institutionLabel: string;
    institutionIcon: string;
    name: string;
    version: string;
    updated: string;
    status: ParserTemplateStatus;
    regex: string;
    note: string;
    healthScore: number | null;
    sourceType: "core" | "local";
  }

  const initialParserTemplates: ParserTemplateCard[] = [
    {
      id: "cbe_debit_v1",
      institutionKey: "CBE",
      institutionLabel: "Commercial Bank of Ethiopia",
      institutionIcon: "account_balance",
      name: "Debit Notification",
      version: "v1.0.0",
      updated: "Updated 2d ago",
      status: "active",
      regex:
        "debited with ETB\\s(?<amount>[\\d,]+\\.\\d{2}).*?at\\s(?<merchant>.*?)\\.\\sBal ETB\\s(?<balance>[\\d,]+\\.\\d{2})",
      note: "Primary debit route with running balance capture.",
      healthScore: 99.2,
      sourceType: "core",
    },
    {
      id: "dashen_debit_v1",
      institutionKey: "DashenBank",
      institutionLabel: "Dashen Bank",
      institutionIcon: "account_balance",
      name: "Purchase Alert",
      version: "v1.2.0",
      updated: "Updated 5h ago",
      status: "draft",
      regex:
        "debited from account\\s(?<account>[\\d*]+).*?at\\s(?<merchant>.*?)\\.\\sAvailable balance ETB\\s(?<balance>[\\d,]+\\.\\d{2})",
      note: "Draft route being tuned for merchant extraction.",
      healthScore: 84.7,
      sourceType: "core",
    },
    {
      id: "telebirr_paid_goods_v1",
      institutionKey: "127",
      institutionLabel: "Telebirr",
      institutionIcon: "account_balance_wallet",
      name: "Paid Goods",
      version: "v1.4.3",
      updated: "Updated 1w ago",
      status: "active",
      regex:
        "ETB\\s(?<amount>[\\d,]+\\.\\d{2})\\spaid to\\s(?<merchant>.*?)\\sfrom wallet\\s(?<account>[\\d*]+).*?balance ETB\\s(?<balance>[\\d,]+\\.\\d{2})",
      note: "Mobile-money payment route with wallet balance capture.",
      healthScore: 97.6,
      sourceType: "core",
    },
    {
      id: "generic_credit_v1",
      institutionKey: "BOA",
      institutionLabel: "Bank of Abyssinia",
      institutionIcon: "account_balance_wallet",
      name: "Generic Credit Fallback",
      version: "v0.9.5",
      updated: "Updated 1w ago",
      status: "fallback",
      regex:
        "(?<merchant>.*)\\s(?<amount>[\\d,]+\\.\\d{2}).*?(?<currency>ETB|USD)?.*?(?<balance>[\\d,]+\\.\\d{2})?",
      note: "Fallback route for evolving sender formats.",
      healthScore: 71.4,
      sourceType: "core",
    },
  ];

  const persistedWorkspace = useMemo(() => readParserWorkspacePreferences(), []);
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
  const [templateCards, setTemplateCards] = useState<ParserTemplateCard[]>(
    persistedWorkspace?.templates.length
      ? persistedWorkspace.templates
      : initialParserTemplates,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    persistedWorkspace?.selectedTemplateId ||
      persistedWorkspace?.templates[0]?.id ||
      initialParserTemplates[0]?.id ||
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
    sender: "CBE",
    name: "",
    regex: "",
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    feeKey: "fee",
    vatKey: "vat",
    accountKey: "account",
    dateMode: "message_date",
  });
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  const parserPackInputRef = useRef<HTMLInputElement | null>(null);
  const { previewResult, parseAndQueue } = useParser(rawInput, senderLabel);
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
      version: 1,
      templates: templateCards,
      selectedTemplateId,
      senderLabel,
      strictSchemaParsing,
      preserveRawSms,
      autoReconciliation,
      verboseLogging,
    });
  }, [
    autoReconciliation,
    preserveRawSms,
    selectedTemplateId,
    senderLabel,
    strictSchemaParsing,
    templateCards,
    verboseLogging,
  ]);

  const selectedTemplate = useMemo(
    () =>
      templateCards.find((template) => template.id === selectedTemplateId) ??
      templateCards[0] ??
      null,
    [selectedTemplateId, templateCards],
  );

  const groupedTemplates = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        icon: string;
        templates: ParserTemplateCard[];
      }
    >();

    for (const template of templateCards) {
      const current = groups.get(template.institutionKey);

      if (current) {
        current.templates.push(template);
      } else {
        groups.set(template.institutionKey, {
          label: template.institutionLabel,
          icon: template.institutionIcon,
          templates: [template],
        });
      }
    }

    return [...groups.entries()];
  }, [templateCards]);

  const parserSource = useMemo(() => {
    if (!selectedTemplate) {
      return "";
    }

    return `1  function parseSMS(message) {
2    const regex = /${selectedTemplate.regex}/i;
3    const match = message.match(regex);
4
5    if (!match?.groups) {
6      return null;
7    }
8
9    return {
10     amount: match.groups.${templateBuilderDraft.amountKey} ?? null,
11     merchant: match.groups.${templateBuilderDraft.merchantKey} ?? null,
12     balance: match.groups.${templateBuilderDraft.balanceKey} ?? null,
13     fee: match.groups.${templateBuilderDraft.feeKey} ?? null,
14     account: match.groups.${templateBuilderDraft.accountKey} ?? null,
15   };
16 }`;
  }, [selectedTemplate, templateBuilderDraft.accountKey, templateBuilderDraft.amountKey, templateBuilderDraft.balanceKey, templateBuilderDraft.feeKey, templateBuilderDraft.merchantKey]);

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
        .map((template) => template.institutionKey),
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
        "Template workspace saved locally on this device.",
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
    updater: (template: ParserTemplateCard) => ParserTemplateCard,
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

    const duplicatedTemplate: ParserTemplateCard = {
      ...selectedTemplate,
      id: `${selectedTemplate.id}-copy-${Date.now()}`,
      name: `${selectedTemplate.name} Copy`,
      version: "v0.1.0",
      updated: "Updated just now",
      status: "draft",
      sourceType: "local",
    };

    setTemplateCards((current) => [duplicatedTemplate, ...current]);
    setSelectedTemplateId(duplicatedTemplate.id);
    showParserStatus("Duplicated the selected template into a local draft.", "success");
  }

  function handlePrimaryTemplate() {
    if (!selectedTemplate) {
      return;
    }

    setTemplateCards((current) =>
      current.map((template) => {
        if (template.institutionKey !== selectedTemplate.institutionKey) {
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

    const senderOption =
      parserSenderOptions.find((option) => option.value === templateBuilderDraft.sender) ??
      parserSenderOptions[0];

    const nextTemplate: ParserTemplateCard = {
      id: `${senderOption.value.toLowerCase()}-draft-${Date.now()}`,
      institutionKey: senderOption.value,
      institutionLabel: senderOption.label,
      institutionIcon:
        senderOption.value === "127" ? "account_balance_wallet" : "account_balance",
      name: templateBuilderDraft.name.trim(),
      version: "v0.1.0",
      updated: "Updated just now",
      status: "draft",
      regex: templateBuilderDraft.regex.trim(),
      note: `${templateBuilderDraft.direction} route with ${templateBuilderDraft.amountKey}, ${templateBuilderDraft.merchantKey}, ${templateBuilderDraft.balanceKey}`,
      healthScore: null,
      sourceType: "local",
    };

    setTemplateCards((current) => [nextTemplate, ...current]);
    setSelectedTemplateId(nextTemplate.id);
    setSenderLabel(senderOption.value);
    setIsTemplateBuilderOpen(false);
    setTemplateBuilderDraft((current) => ({
      ...current,
      name: "",
      regex: "",
    }));
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
        templates?: ParserTemplateCard[];
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
    setTemplateCards(initialParserTemplates);
    setSelectedTemplateId(initialParserTemplates[0]?.id ?? "");
    setSenderLabel("CBE");
    setStrictSchemaParsing(true);
    setPreserveRawSms(true);
    setAutoReconciliation(false);
    setVerboseLogging(false);
    showParserStatus("Reset local parser cache and preview controls.", "warning");
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
                        onClick={() => setSelectedTemplateId(template.id)}
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
                      direction: event.target.value,
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
                  Date mode
                </span>
                <select
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface px-4 py-3 text-on-surface"
                  onChange={(event) =>
                    setTemplateBuilderDraft((current) => ({
                      ...current,
                      dateMode: event.target.value,
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
  const nearbySyncDevices = useTransactionStore((state) => state.nearbySyncDevices);
  const pairingCodeState = useTransactionStore((state) => state.pairingCodeState);
  const updatePairingCodeInput = useTransactionStore(
    (state) => state.updatePairingCodeInput,
  );
  const submitPairingCode = useTransactionStore((state) => state.submitPairingCode);
  const [manualConnectState, setManualConnectState] =
    useState<ActionState>("idle");
  const [scannerState, setScannerState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const codeDigits = pairingCodeState.pendingCodeInput
    .padEnd(6, " ")
    .slice(0, 6)
    .split("");
  const expiresAt = new Date(pairingCodeState.expiresAt).getTime();
  const remainingMinutes = Math.max(
    0,
    Math.ceil((expiresAt - now) / (60 * 1000)),
  );
  const pairingWindowLabel =
    remainingMinutes > 0
      ? `Current pairing window expires in about ${remainingMinutes} minute${
          remainingMinutes === 1 ? "" : "s"
        }.`
      : "Current pairing window expired. Generate a fresh code from the source device.";

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  function showConnectStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2400);
  }

  function updateCodeDigit(index: number, value: string) {
    const next = pairingCodeState.pendingCodeInput
      .padEnd(6, " ")
      .slice(0, 6)
      .split("");

    next[index] = value.replace(/\s/g, "").slice(-1);
    updatePairingCodeInput(next.join("").trimEnd());
  }

  function handleManualConnect() {
    setManualConnectState("working");

    setTimeout(() => {
      const pairedDevice = submitPairingCode();
      const nextPairingState = transactionStore.getState().pairingCodeState;

      if (pairedDevice) {
        setManualConnectState("done");
        showConnectStatus(
          pairedDevice.deviceId.startsWith("code-paired-")
            ? `${pairedDevice.displayName} is now available as a local preview route in Sync.`
            : `${pairedDevice.displayName} is now trusted and available in Sync.`,
          "success",
        );
        setTimeout(() => {
          setManualConnectState("idle");
          onOpenPage("sync");
        }, 850);
        return;
      }

      setManualConnectState("idle");
      showConnectStatus(
        nextPairingState.errorMessage ??
          "That pairing code could not be trusted yet.",
        "error",
      );
    }, 700);
  }

  function handleScannerOpen() {
    setScannerState("working");

    setTimeout(() => {
      setScannerState("idle");
      showConnectStatus(
        nearbySyncDevices.length > 0
          ? `${nearbySyncDevices.length} nearby device${
              nearbySyncDevices.length === 1 ? "" : "s"
            } already appeared in Sync. Use the 6-digit code below or pair from the Sync page while camera scanning is being wired.`
          : "Camera scanning is not wired in this build yet. Start nearby discovery from Sync or use the 6-digit code below.",
        "warning",
      );
    }, 700);
  }

  return (
    <section className="mx-auto max-w-md space-y-6">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <div className="text-center">
        <h2 className="font-headline text-2xl text-on-surface">
          Pair a New Device
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Securely connect a nearby device or a local preview route to your wallet
          workspace.
        </p>
      </div>

      <section className="flex flex-col items-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-sm">
        <div className="mb-4">
          <MaterialSymbol
            className="mb-2 block text-center text-4xl text-primary"
            filled
            name="qr_code_scanner"
          />
          <h3 className="text-center font-headline text-lg text-on-surface">
            Scan QR Code
          </h3>
          <p className="mt-1 text-center text-sm text-on-surface-variant">
            Point your camera at the desktop pairing screen.
          </p>
        </div>
        <div className="mb-4 rounded-2xl bg-surface p-4 text-left">
          <p className="text-sm font-semibold text-on-surface">
            Pairing window
          </p>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {pairingWindowLabel}
          </p>
        </div>
        <div className="mb-6 flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-high">
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-surface p-4 shadow-sm">
            {Array.from({ length: 16 }).map((_, index) => (
              <div
                className={`h-5 w-5 rounded-sm ${
                  index % 3 === 0 ? "bg-primary" : "bg-surface-container-high"
                }`}
                key={index}
              />
            ))}
          </div>
        </div>
        <ActionStatusButton
          actionState={scannerState}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary"
          doneLabel="Scanned"
          idleLabel="Open Scanner"
          onClick={handleScannerOpen}
          workingLabel="Opening..."
        />
      </section>

      <div className="flex items-center gap-4 py-2">
        <div className="h-px flex-1 bg-outline-variant/50" />
        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Or
        </span>
        <div className="h-px flex-1 bg-outline-variant/50" />
      </div>

      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <MaterialSymbol className="text-tertiary" name="keyboard" />
          <div>
            <h3 className="font-headline text-lg text-on-surface">
              Enter Device Code
            </h3>
            <p className="text-sm text-on-surface-variant">
              Type the 6-digit PIN displayed on the source device.
            </p>
          </div>
        </div>
        <div className="mb-3 flex justify-between gap-2">
          {codeDigits.map((digit, index) => (
            <input
              aria-label={`Pairing digit ${index + 1}`}
              className="h-14 w-12 rounded-lg border border-outline-variant bg-surface text-center text-xl font-bold text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              key={index}
              maxLength={1}
              onChange={(event) => updateCodeDigit(index, event.target.value)}
              placeholder="0"
              type="text"
              value={digit.trim()}
            />
          ))}
        </div>
        {pairingCodeState.errorMessage ? (
          <p className="mb-4 text-xs font-medium text-error">
            {pairingCodeState.errorMessage}
          </p>
        ) : null}
        <ActionStatusButton
          actionState={manualConnectState}
          className="w-full rounded-xl border border-primary bg-surface-container-high px-4 py-3 font-bold text-primary"
          doneLabel="Trusted"
          idleLabel="Connect"
          onClick={handleManualConnect}
          workingLabel="Connecting..."
        />
      </section>
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
  const toggleSyncEnabled = useTransactionStore((state) => state.toggleSyncEnabled);
  const setSyncMode = useTransactionStore((state) => state.setSyncMode);
  const startSyncDiscovery = useTransactionStore(
    (state) => state.startSyncDiscovery,
  );
  const stopSyncDiscovery = useTransactionStore((state) => state.stopSyncDiscovery);
  const triggerManualSync = useTransactionStore(
    (state) => state.triggerManualSync,
  );
  const pairNearbyDevice = useTransactionStore((state) => state.pairNearbyDevice);
  const markTrustedDeviceAsPrimary = useTransactionStore(
    (state) => state.markTrustedDeviceAsPrimary,
  );
  const removeTrustedDevice = useTransactionStore(
    (state) => state.removeTrustedDevice,
  );
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  const [refreshState, setRefreshState] = useState<ActionState>("idle");
  const [connectingNearbyId, setConnectingNearbyId] = useState<string | null>(
    null,
  );
  const [trustedNearbyId, setTrustedNearbyId] = useState<string | null>(null);

  const primaryTrustedDevice =
    trustedSyncDevices.find((device) => device.isPrimary) ??
    trustedSyncDevices[0] ??
    null;
  const latestSync =
    syncActivity.find((entry) => entry.type === "sync") ?? null;
  const recentSyncActivity = syncActivity.slice(0, 5);

  function showSyncStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    setTimeout(() => setStatusToast(null), 2400);
  }

  function handleManualRefresh() {
    setRefreshState("working");

    setTimeout(() => {
      triggerManualSync();
      const latestEntry = transactionStore.getState().syncActivity[0];
      const isSuccess = latestEntry?.status === "success";

      if (isSuccess) {
        setRefreshState("done");
        setTimeout(() => setRefreshState("idle"), 1200);
      } else {
        setRefreshState("idle");
      }

      showSyncStatus(
        latestEntry?.detail ?? "Sync status refreshed.",
        isSuccess ? "success" : "warning",
      );
    }, 700);
  }

  function handleMakePrimary(deviceId: string, displayName: string) {
    markTrustedDeviceAsPrimary(deviceId);
    showSyncStatus(`${displayName} is now the primary sync route.`, "success");
  }

  function handleDisconnect(deviceId: string, displayName: string) {
    removeTrustedDevice(deviceId);
    showSyncStatus(`${displayName} was removed from trusted devices.`, "warning");
  }

  function handlePairNearby(device: NearbySyncDevice) {
    setConnectingNearbyId(device.deviceId);

    setTimeout(() => {
      const trustedDevice = pairNearbyDevice(device.deviceId);
      setConnectingNearbyId(null);

      if (trustedDevice) {
        setTrustedNearbyId(device.deviceId);
        showSyncStatus(
          `${trustedDevice.displayName} moved into your trusted routes.`,
          "success",
        );
        setTimeout(() => setTrustedNearbyId(null), 1200);
        return;
      }

      showSyncStatus(
        "That nearby device was not available anymore. Start discovery again.",
        "error",
      );
    }, 700);
  }

  return (
    <section className="space-y-8">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}
      <header className="mb-10">
        <h2 className="font-headline text-3xl font-bold text-on-surface md:text-4xl">
          Sync &amp; Devices
        </h2>
        <p className="mt-2 text-lg text-on-surface-variant">
          Manage local authority connectivity and trusted hardware surfaces in
          one grounded space.
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
                      ? `${formatPlatformLabel(primaryTrustedDevice.platform)} • ${syncStatusSummary.headline}`
                      : "Discover or trust a desktop route to set a primary path."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                  onClick={() =>
                    syncDiscoveryState === "searching"
                      ? stopSyncDiscovery()
                      : startSyncDiscovery()
                  }
                  type="button"
                >
                  {syncDiscoveryState === "searching"
                    ? "Stop discovery"
                    : "Discover nearby"}
                </button>
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                  onClick={() => onOpenPage("connect-device")}
                  type="button"
                >
                  Add Device
                </button>
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
              Overall system posture based on your local authority route.
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
          <div className="mt-8 grid gap-3">
            <ActionStatusButton
              actionState={refreshState}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-surface py-3 font-semibold text-primary"
              doneLabel="Refreshed"
              idleLabel="Refresh Status"
              onClick={handleManualRefresh}
              workingLabel="Refreshing..."
            />
            <div className="flex items-center justify-between rounded-xl bg-surface p-3">
              <span className="text-sm font-medium text-on-surface">
                Sync enabled
              </span>
              <SwitchButton
                ariaLabel="Toggle sync enabled"
                checked={syncEnabled}
                onToggle={toggleSyncEnabled}
              />
            </div>
            <div className="flex overflow-hidden rounded-xl border border-outline-variant/30 bg-surface">
              {(["automatic", "manual"] as const).map((mode) => (
                <button
                  className={`flex-1 py-3 text-sm font-medium capitalize ${
                    syncMode === mode
                      ? "bg-primary-container/20 font-semibold text-primary"
                      : "text-on-surface-variant"
                  }`}
                  key={mode}
                  onClick={() => setSyncMode(mode)}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
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
                Manage trusted routes and discovered nearby devices.
              </p>
            </div>
            <button
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary"
              onClick={() => onOpenPage("connect-device")}
              type="button"
            >
              <MaterialSymbol name="add" />
              Add Device
            </button>
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
                    <button
                      className={`text-sm font-semibold ${
                        device.isPrimary
                          ? "text-on-surface-variant"
                          : "text-primary hover:underline"
                      }`}
                      disabled={device.isPrimary}
                      onClick={() =>
                        handleMakePrimary(device.deviceId, device.displayName)
                      }
                      type="button"
                    >
                      {device.isPrimary ? "Primary route" : "Set primary"}
                    </button>
                    <button
                      className="text-sm font-semibold text-error hover:underline"
                      onClick={() =>
                        handleDisconnect(device.deviceId, device.displayName)
                      }
                      type="button"
                    >
                      Disconnect
                    </button>
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
                    {connectingNearbyId === device.deviceId ? (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                        Pairing...
                      </span>
                    ) : trustedNearbyId === device.deviceId ? (
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        <MaterialSymbol className="text-[18px]" filled name="check" />
                        Trusted
                      </span>
                    ) : (
                      <button
                        className="text-sm font-semibold text-primary hover:underline"
                        onClick={() => handlePairNearby(device)}
                        type="button"
                      >
                        Pair now
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {trustedSyncDevices.length === 0 && nearbySyncDevices.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
              No devices are available yet. Start discovery or open Connect
              Device to pair one manually.
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
                The latest local discovery, trust, and sync events from this
                phone.
              </p>
            </div>
            <button
              className="rounded-lg border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-on-surface"
              onClick={() => onOpenPage("connect-device")}
              type="button"
            >
              Open pairing
            </button>
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
                        {entry.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                        {entry.detail}
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
                Sync activity will appear here after discovery, pairing, or a
                manual refresh.
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
}: SettingsDetailScreenProps) {
  let page: ReactNode;

  switch (pageId) {
    case "account":
      page = <ManageAccountPage />;
      break;
    case "appearance":
      page = <AppearancePage orderedAccountIds={orderedAccountIds} />;
      break;
    case "security":
      page = <SecurityPage />;
      break;
    case "dataStorage":
      page = <DataStoragePage />;
      break;
    case "parsing":
      page = <ParsingPage onOpenTab={onOpenTab} />;
      break;
    case "forwarding":
      page = <ForwardingPage />;
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
      page = <AdvancedPage />;
  }

  return (
    <>
      <SettingsMotionStyles />
      {page}
    </>
  );
}
