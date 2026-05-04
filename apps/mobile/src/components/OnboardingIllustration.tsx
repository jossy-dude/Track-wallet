import { MaterialSymbol } from "@omni-sync/ui";

export type OnboardingIllustrationId =
  | "password-vault"
  | "capture-lane"
  | "approval-stack"
  | "accounts-budget";

interface OnboardingIllustrationProps {
  accent: "primary" | "secondary" | "tertiary";
  illustration: OnboardingIllustrationId;
}

const accentClassMap: Record<
  OnboardingIllustrationProps["accent"],
  {
    halo: string;
    panel: string;
    panelMuted: string;
    text: string;
    solid: string;
  }
> = {
  primary: {
    halo: "bg-primary/18",
    panel: "bg-primary-container/80",
    panelMuted: "bg-primary-container/35",
    text: "text-primary",
    solid: "bg-primary",
  },
  secondary: {
    halo: "bg-secondary/18",
    panel: "bg-secondary-container/85",
    panelMuted: "bg-secondary-container/35",
    text: "text-secondary",
    solid: "bg-secondary",
  },
  tertiary: {
    halo: "bg-tertiary/18",
    panel: "bg-tertiary-container/85",
    panelMuted: "bg-tertiary-container/35",
    text: "text-tertiary",
    solid: "bg-tertiary",
  },
};

function PasswordVaultIllustration({
  classes,
}: {
  classes: (typeof accentClassMap)[OnboardingIllustrationProps["accent"]];
}) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[32px] border border-white/55 bg-white/75 px-6 py-5 shadow-[0_12px_28px_rgba(34,39,36,0.12)] backdrop-blur">
      <div className={`absolute -left-8 -top-8 h-28 w-28 rounded-full blur-2xl ${classes.halo}`} />
      <div className={`absolute -bottom-8 -right-6 h-24 w-24 rounded-full blur-2xl ${classes.halo}`} />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
              Private setup
            </p>
            <p className="mt-2 text-sm font-semibold text-on-surface">
              Your device becomes the first checkpoint
            </p>
          </div>
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/60 shadow-sm ${classes.panel}`}
          >
            <MaterialSymbol className={`text-[28px] ${classes.text}`} filled name="lock" />
          </div>
        </div>

        <div className="flex items-end justify-between gap-5">
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }, (_, index) => (
              <div
                className={`h-11 w-11 rounded-2xl border border-white/55 shadow-sm ${
                  index === 4 ? classes.panel : "bg-white/70"
                }`}
                key={`pin-key-${index}`}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-white/65 bg-white/70 shadow-[0_10px_24px_rgba(34,39,36,0.12)]">
              <div className={`absolute inset-3 rounded-full ${classes.panelMuted}`} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-white/85">
                <MaterialSymbol
                  className={`text-[28px] ${classes.text}`}
                  filled
                  name="verified_user"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    index < 3 ? classes.solid : "bg-outline-variant"
                  }`}
                  key={`pin-dot-${index}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureLaneIllustration({
  classes,
}: {
  classes: (typeof accentClassMap)[OnboardingIllustrationProps["accent"]];
}) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[32px] border border-white/55 bg-white/75 px-5 py-5 shadow-[0_12px_28px_rgba(34,39,36,0.12)] backdrop-blur">
      <div className={`absolute right-4 top-4 h-20 w-20 rounded-full blur-2xl ${classes.halo}`} />

      <div className="relative flex h-full items-center justify-between gap-4">
        <div className="w-[34%] space-y-3">
          {[
            ["sms", "SMS alert"],
            ["edit_note", "Manual entry"],
            ["content_paste", "Copied receipt"],
          ].map(([icon, label], index) => (
            <div
              className={`rounded-[22px] border border-white/60 px-3 py-3 shadow-sm ${
                index === 1 ? classes.panelMuted : "bg-white/70"
              }`}
              key={label}
            >
              <div className="flex items-center gap-2">
                <MaterialSymbol className={`text-[18px] ${classes.text}`} filled name={icon} />
                <span className="text-xs font-semibold text-on-surface">{label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex w-[10%] flex-col items-center gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className={`h-3 w-3 rounded-full ${
                index === 1 || index === 2 ? classes.solid : "bg-outline-variant/70"
              }`}
              key={`lane-dot-${index}`}
            />
          ))}
        </div>

        <div className="w-[46%] rounded-[26px] border border-white/60 bg-white/82 p-4 shadow-[0_10px_22px_rgba(34,39,36,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                Capture lane
              </p>
              <p className="mt-1 text-base font-semibold text-on-surface">
                One intake, one review point
              </p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes.panel}`}>
              <MaterialSymbol className={`text-[22px] ${classes.text}`} filled name="hub" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {[
              "Parser suggests the details",
              "You confirm or correct the record",
              "Only approved items hit the ledger",
            ].map((line, index) => (
              <div className="flex items-start gap-2.5" key={line}>
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    index === 2 ? classes.solid : classes.panel
                  }`}
                />
                <p className="text-xs leading-5 text-on-surface-variant">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalStackIllustration({
  classes,
}: {
  classes: (typeof accentClassMap)[OnboardingIllustrationProps["accent"]];
}) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[32px] border border-white/55 bg-white/75 px-5 py-5 shadow-[0_12px_28px_rgba(34,39,36,0.12)] backdrop-blur">
      <div className={`absolute -left-3 top-10 h-20 w-20 rounded-full blur-2xl ${classes.halo}`} />
      <div className="relative flex h-full items-center justify-center">
        <div className="relative h-full w-full max-w-[18rem]">
          {[
            { rotate: "-rotate-6", top: "top-10", state: "Edit" },
            { rotate: "rotate-3", top: "top-6", state: "Review" },
            { rotate: "", top: "top-0", state: "Approve" },
          ].map((card, index) => (
            <div
              className={`absolute ${card.top} left-1/2 w-full -translate-x-1/2 rounded-[28px] border border-white/60 bg-white/84 p-4 shadow-[0_10px_22px_rgba(34,39,36,0.09)] ${card.rotate}`}
              key={card.state}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    Inbox item
                  </p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">
                    ETB {(12.5 + index * 4.25).toFixed(2)} grocery spend
                  </p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${classes.panel}`}>
                  <MaterialSymbol
                    className={`text-[20px] ${classes.text}`}
                    filled
                    name={index === 0 ? "edit" : index === 1 ? "rule" : "task_alt"}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                <span>{card.state}</span>
                <span>{index === 2 ? "Ledger ready" : "Needs you"}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-surface-container">
                <div
                  className={`h-2 rounded-full ${
                    index === 2 ? classes.solid : index === 1 ? classes.panel : "bg-outline-variant"
                  }`}
                  style={{ width: `${42 + index * 22}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountsBudgetIllustration({
  classes,
}: {
  classes: (typeof accentClassMap)[OnboardingIllustrationProps["accent"]];
}) {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[32px] border border-white/55 bg-white/75 px-5 py-5 shadow-[0_12px_28px_rgba(34,39,36,0.12)] backdrop-blur">
      <div className={`absolute -right-4 bottom-6 h-24 w-24 rounded-full blur-2xl ${classes.halo}`} />

      <div className="relative grid h-full grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="space-y-3 rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-[0_10px_22px_rgba(34,39,36,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                Accounts
              </p>
              <p className="mt-1 text-base font-semibold text-on-surface">
                Total tracked money
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${classes.panel}`}>
              <MaterialSymbol
                className={`text-[20px] ${classes.text}`}
                filled
                name="account_balance_wallet"
              />
            </div>
          </div>

          {[
            ["Bank", "56%"],
            ["Mobile money", "31%"],
            ["Cash", "13%"],
          ].map(([label, share], index) => (
            <div key={label}>
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                <span>{label}</span>
                <span>{share}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-surface-container">
                <div
                  className={`h-2 rounded-full ${
                    index === 0 ? classes.solid : index === 1 ? classes.panel : "bg-outline-variant"
                  }`}
                  style={{ width: share }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-[28px] border border-white/60 bg-white/84 p-4 shadow-[0_10px_22px_rgba(34,39,36,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
              Budget watch
            </p>
            <div className="mt-3 flex items-end gap-2">
              {[72, 54, 88, 41].map((height, index) => (
                <div className="flex-1" key={`budget-bar-${height}`}>
                  <div
                    className={`w-full rounded-t-2xl ${
                      index === 2 ? classes.solid : classes.panel
                    }`}
                    style={{ height: `${height}px` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-[28px] border border-white/60 p-4 shadow-[0_10px_22px_rgba(34,39,36,0.08)] ${classes.panelMuted}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/75">
                <MaterialSymbol className={`text-[22px] ${classes.text}`} filled name="insights" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Budget pressure shows early
                </p>
                <p className="text-xs leading-5 text-on-surface-variant">
                  Watch limits tighten before the month gets away from you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnboardingIllustration({
  accent,
  illustration,
}: OnboardingIllustrationProps) {
  const classes = accentClassMap[accent];

  if (illustration === "password-vault") {
    return <PasswordVaultIllustration classes={classes} />;
  }

  if (illustration === "capture-lane") {
    return <CaptureLaneIllustration classes={classes} />;
  }

  if (illustration === "approval-stack") {
    return <ApprovalStackIllustration classes={classes} />;
  }

  return <AccountsBudgetIllustration classes={classes} />;
}
