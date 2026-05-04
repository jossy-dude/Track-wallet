import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import {
  AmountFigure,
  formatCurrencyAmount,
} from "./AmountFigure";
import type { CurrencyLabelPreference } from "../preferences/displayPreferences";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatVisibleAccountNumber(value: string) {
  const digits = digitsOnly(value);

  if (digits.length < 5) {
    return value;
  }

  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatMaskedLastFour(masked: string, full?: string) {
  const sourceDigits = digitsOnly(full ?? masked);

  if (sourceDigits.length >= 4) {
    return `•••• ${sourceDigits.slice(-4)}`;
  }

  return masked;
}

export type WalletCardTemplateId =
  | "mist"
  | "harbor"
  | "ember"
  | "obsidian"
  | "linen"
  | "aurora";
export type WalletAccentId =
  | "lagoon-mist"
  | "ember-copper"
  | "night-current"
  | "sage-clay"
  | "violet-tide"
  | "sand-glow";

export interface WalletCardVisual {
  accountId: string;
  institutionName: string;
  maskedAccountNumber: string;
  fullAccountNumber?: string;
  balanceMinor: number;
  iconName: string;
  templateId: WalletCardTemplateId;
  accentId: WalletAccentId;
  tag?: string;
  helperLabel?: string;
  currencyLabel?: CurrencyLabelPreference;
  isDefault?: boolean;
}

interface WalletAccentPreset {
  id: WalletAccentId;
  label: string;
  cardBase: string;
  cardBorder: string;
  chip: string;
  text: string;
  subduedText: string;
  subtleOrbA: string;
  subtleOrbB: string;
  surfaceMode: "light" | "dark";
}

export const walletAccentPresets: readonly WalletAccentPreset[] = [
  {
    id: "lagoon-mist",
    label: "Lagoon Mist",
    cardBase: "from-[#dff4f7] via-[#f8fdff] to-[#eef2ff]",
    cardBorder: "border-[#d8e6ed]",
    chip: "bg-white/72 text-[#3a6470]",
    text: "text-[#29404a]",
    subduedText: "text-[#67808c]",
    subtleOrbA: "bg-[#d9f4f8]",
    subtleOrbB: "bg-[#dde4ff]",
    surfaceMode: "light",
  },
  {
    id: "ember-copper",
    label: "Ember Copper",
    cardBase: "from-[#f9ecdf] via-[#fff9f4] to-[#f6e6e0]",
    cardBorder: "border-[#ebddd3]",
    chip: "bg-white/78 text-[#80533c]",
    text: "text-[#523224]",
    subduedText: "text-[#8e6c58]",
    subtleOrbA: "bg-[#f8dcc8]",
    subtleOrbB: "bg-[#f6ead7]",
    surfaceMode: "light",
  },
  {
    id: "night-current",
    label: "Night Current",
    cardBase: "from-[#202634] via-[#252d3d] to-[#313b53]",
    cardBorder: "border-[#44506a]",
    chip: "bg-white/10 text-white/85",
    text: "text-white",
    subduedText: "text-white/70",
    subtleOrbA: "bg-[#304a89]",
    subtleOrbB: "bg-[#3bcbd4]",
    surfaceMode: "dark",
  },
  {
    id: "sage-clay",
    label: "Sage Clay",
    cardBase: "from-[#dde8de] via-[#f7fbf7] to-[#f1e7de]",
    cardBorder: "border-[#dbe3d9]",
    chip: "bg-white/74 text-[#56675a]",
    text: "text-[#38473d]",
    subduedText: "text-[#6f7d72]",
    subtleOrbA: "bg-[#dff0e3]",
    subtleOrbB: "bg-[#eddccd]",
    surfaceMode: "light",
  },
  {
    id: "violet-tide",
    label: "Violet Tide",
    cardBase: "from-[#ece6fd] via-[#fcf9ff] to-[#dfeeff]",
    cardBorder: "border-[#e3dcfb]",
    chip: "bg-white/74 text-[#645f88]",
    text: "text-[#45466b]",
    subduedText: "text-[#7d7da0]",
    subtleOrbA: "bg-[#ddd5ff]",
    subtleOrbB: "bg-[#d4ebff]",
    surfaceMode: "light",
  },
  {
    id: "sand-glow",
    label: "Sand Glow",
    cardBase: "from-[#f6efd9] via-[#fffef8] to-[#f3eddc]",
    cardBorder: "border-[#e9e1c8]",
    chip: "bg-white/76 text-[#726036]",
    text: "text-[#4b3b22]",
    subduedText: "text-[#8b7a60]",
    subtleOrbA: "bg-[#f2e3b0]",
    subtleOrbB: "bg-[#f1ead4]",
    surfaceMode: "light",
  },
] as const;

export const walletTemplateOptions = [
  {
    id: "mist",
    title: "Float",
    description: "Airy balance card with soft corner drift",
  },
  {
    id: "harbor",
    title: "Harbor",
    description: "Tighter frame with stronger corner anchors",
  },
  {
    id: "ember",
    title: "Ribbon",
    description: "Diagonal ribbon highlight and compact footer",
  },
  {
    id: "obsidian",
    title: "Night",
    description: "High-contrast stack for darker accents",
  },
  {
    id: "linen",
    title: "Paper",
    description: "Soft editorial surface with warm chip label",
  },
  {
    id: "aurora",
    title: "Aurora",
    description: "Lifted gradient orb treatment for hero cards",
  },
] as const satisfies readonly {
  id: WalletCardTemplateId;
  title: string;
  description: string;
}[];

export function resolveWalletAccent(accentId: WalletAccentId) {
  return (
    walletAccentPresets.find((preset) => preset.id === accentId) ??
    walletAccentPresets[0]
  );
}

export function deriveWalletVisualSeed(
  accountId: string,
  channel: "bank" | "mobile_money" | "cash",
) {
  const templates: WalletCardTemplateId[] = [
    "mist",
    "harbor",
    "ember",
    "obsidian",
    "linen",
    "aurora",
  ];
  const accentsByChannel: Record<typeof channel, readonly WalletAccentId[]> = {
    bank: ["lagoon-mist", "night-current", "sand-glow"],
    mobile_money: ["violet-tide", "lagoon-mist", "sage-clay"],
    cash: ["ember-copper", "sand-glow", "sage-clay"],
  };

  const hash = Array.from(accountId).reduce(
    (sum, character, index) => sum + character.charCodeAt(0) * (index + 11),
    0,
  );

  return {
    templateId: templates[hash % templates.length],
    accentId: accentsByChannel[channel][hash % accentsByChannel[channel].length],
  };
}

function renderTemplateChrome(templateId: WalletCardTemplateId, accent: WalletAccentPreset) {
  if (templateId === "obsidian") {
    return (
      <>
        <div className={cn("absolute -right-10 -top-6 h-28 w-28 rounded-full opacity-55 blur-2xl", accent.subtleOrbA)} />
        <div className={cn("absolute -left-10 bottom-0 h-24 w-24 rounded-full opacity-40 blur-2xl", accent.subtleOrbB)} />
      </>
    );
  }

  if (templateId === "ember") {
    return (
      <>
        <div className="absolute -right-12 top-4 h-16 w-44 rotate-[20deg] rounded-full bg-white/45 blur-xl" />
        <div className={cn("absolute -left-8 -bottom-4 h-20 w-28 rounded-full opacity-50 blur-2xl", accent.subtleOrbA)} />
      </>
    );
  }

  if (templateId === "linen") {
    return (
      <>
        <div className="absolute inset-x-6 top-6 h-px bg-white/70" />
        <div className="absolute inset-x-8 bottom-8 h-px bg-white/45" />
      </>
    );
  }

  if (templateId === "aurora") {
    return (
      <>
        <div className={cn("absolute -right-10 top-0 h-32 w-32 rounded-full opacity-55 blur-3xl", accent.subtleOrbA)} />
        <div className={cn("absolute left-12 bottom-0 h-20 w-20 rounded-full opacity-40 blur-2xl", accent.subtleOrbB)} />
      </>
    );
  }

  if (templateId === "harbor") {
    if (accent.surfaceMode === "dark") {
      return (
        <>
          <div className="absolute left-5 top-[4.3rem] h-px w-16 bg-white/18" />
          <div className="absolute right-7 top-7 h-px w-20 bg-white/30" />
          <div className={cn("absolute -right-8 bottom-4 h-20 w-24 rounded-full opacity-28 blur-3xl", accent.subtleOrbB)} />
        </>
      );
    }

    return (
      <>
        <div className="absolute left-5 top-[4.75rem] h-px w-14 bg-white/28" />
        <div className="absolute left-5 top-[4.75rem] h-10 w-10 rounded-[18px] border border-white/10 bg-white/[0.04]" />
        <div className="absolute right-7 top-7 h-px w-20 bg-white/35" />
        <div className={cn("absolute -right-6 bottom-3 h-16 w-24 rounded-full opacity-40 blur-2xl", accent.subtleOrbB)} />
      </>
    );
  }

  return (
    <>
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-45 blur-2xl", accent.subtleOrbA)} />
      <div className={cn("absolute left-10 bottom-1 h-20 w-20 rounded-full opacity-35 blur-2xl", accent.subtleOrbB)} />
    </>
  );
}

export function PocketWalletCard({
  visual,
  className,
  showRevealControl = true,
  hideSensitiveByDefault = true,
  isSensitiveHidden: controlledSensitiveHidden,
  onSensitiveVisibilityChange,
}: {
  visual: WalletCardVisual;
  className?: string;
  showRevealControl?: boolean;
  hideSensitiveByDefault?: boolean;
  isSensitiveHidden?: boolean;
  onSensitiveVisibilityChange?: (nextValue: boolean) => void;
}) {
  const accent = resolveWalletAccent(visual.accentId);
  const helperLabel = visual.helperLabel ?? "Track Wallet";
  const [uncontrolledSensitiveHidden, setUncontrolledSensitiveHidden] = useState(
    hideSensitiveByDefault,
  );
  const isSensitiveHidden =
    controlledSensitiveHidden ?? uncontrolledSensitiveHidden;
  const revealedAccountNumber = formatVisibleAccountNumber(
    visual.fullAccountNumber ?? visual.maskedAccountNumber,
  );
  const hiddenAccountNumber = visual.maskedAccountNumber.includes("****")
    ? visual.maskedAccountNumber.replace("****", "••••")
    : visual.maskedAccountNumber;
  void hiddenAccountNumber;
  const shownAccountNumber = isSensitiveHidden
    ? formatMaskedLastFour(visual.maskedAccountNumber, visual.fullAccountNumber)
    : revealedAccountNumber;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[30px] border bg-gradient-to-br p-5 shadow-[0_20px_40px_rgba(61,67,64,0.14)] ring-1 ring-white/55",
        accent.cardBase,
        accent.cardBorder,
        className,
      )}
    >
      <div className="absolute inset-[1px] rounded-[29px] border border-white/38" />
      {renderTemplateChrome(visual.templateId, accent)}
      <div className="relative z-10 flex min-h-[182px] flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", accent.chip)}>
            {visual.institutionName}
          </div>
          <div className="flex items-center gap-2">
            {visual.isDefault ? (
              <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", accent.chip)}>
                Default
              </span>
            ) : null}
            {showRevealControl ? (
              <button
                aria-label={isSensitiveHidden ? "Show account details" : "Hide account details"}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/32 transition active:scale-[0.97]",
                  accent.text,
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const nextValue = !isSensitiveHidden;
                  if (controlledSensitiveHidden === undefined) {
                    setUncontrolledSensitiveHidden(nextValue);
                  }
                  onSensitiveVisibilityChange?.(nextValue);
                }}
                type="button"
              >
                <MaterialSymbol
                  className="text-[20px]"
                  name={isSensitiveHidden ? "visibility" : "visibility_off"}
                />
              </button>
            ) : (
              <MaterialSymbol className={cn("rotate-[-18deg] text-[22px]", accent.text)} name="wifi" />
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", accent.subduedText)}>
              {helperLabel}
            </p>
            <div
              className={cn(
                "mt-3 font-headline text-[29px] font-semibold tracking-[0.12em]",
                accent.text,
              )}
            >
              {shownAccountNumber.replace("****", "••••")}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={cn("text-[11px] uppercase tracking-[0.18em]", accent.subduedText)}>
                {visual.tag ?? "Account Holder"}
              </p>
              <p className={cn("mt-1 text-sm font-semibold", accent.text)}>
                {visual.institutionName}
              </p>
            </div>
            <AmountFigure
              amountMinor={visual.balanceMinor}
              className={cn("gap-2", accent.surfaceMode === "dark" ? "items-center" : "")}
              compact
              currencyLabel={visual.currencyLabel}
              labelClassName={cn(
                accent.subduedText,
                accent.surfaceMode === "dark"
                  ? "translate-y-0 rounded-full bg-white/10 px-2 py-[3px] text-[10px] tracking-[0.14em] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                  : "",
              )}
              valueClassName={cn(
                "text-2xl",
                isSensitiveHidden ? "blur-[4.6px] opacity-90" : "",
                accent.text,
              )}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function StackedPocketDeck({
  visuals,
  className,
}: {
  visuals: readonly WalletCardVisual[];
  className?: string;
}) {
  const [orderedAccountIds, setOrderedAccountIds] = useState<string[]>(
    visuals.map((visual) => visual.accountId),
  );
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [draggingAccountId, setDraggingAccountId] = useState<string | null>(null);
  const dragStartYRef = useRef<number | null>(null);

  useEffect(() => {
    setOrderedAccountIds((current) => {
      const nextIds = visuals.map((visual) => visual.accountId);
      const existing = current.filter((accountId) => nextIds.includes(accountId));
      const missing = nextIds.filter((accountId) => !existing.includes(accountId));
      return [...existing, ...missing];
    });
  }, [visuals]);

  const orderedVisuals = useMemo(() => {
    const rank = new Map(orderedAccountIds.map((accountId, index) => [accountId, index]));
    return [...visuals].sort(
      (left, right) =>
        (rank.get(left.accountId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.accountId) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [orderedAccountIds, visuals]);

  function cycleFrontCardToBack() {
    setOrderedAccountIds((current) => {
      if (current.length < 2) {
        return current;
      }

      const [first, ...rest] = current;
      return [...rest, first];
    });
  }

  function cycleBackCardToFront() {
    setOrderedAccountIds((current) => {
      if (current.length < 2) {
        return current;
      }

      const next = [...current];
      const last = next.pop();

      if (!last) {
        return current;
      }

      return [last, ...next];
    });
  }

  function releaseDrag() {
    if (dragStartYRef.current !== null) {
      if (dragDeltaY < -56) {
        cycleFrontCardToBack();
      } else if (dragDeltaY > 56) {
        cycleBackCardToFront();
      }
    }

    dragStartYRef.current = null;
    setDraggingAccountId(null);
    setDragDeltaY(0);
  }

  return (
    <div className={cn("relative h-[294px] [perspective:1200px]", className)}>
      {orderedVisuals.slice(0, 4).map((visual, index) => {
        const stackIndex = index;
        const isSelected = orderedVisuals[0]?.accountId === visual.accountId;
        const offsetY = stackIndex * 18;
        const offsetX = stackIndex * 4;
        const scale = 1 - stackIndex * 0.028;
        const rotation = stackIndex === 0 ? 0 : stackIndex % 2 === 0 ? -1.4 : 1.2;
        const dragLift = isSelected ? Math.max(-86, Math.min(86, dragDeltaY)) : 0;
        const dragTilt = isSelected ? Math.max(-5, Math.min(5, dragDeltaY / 20)) : 0;

        return (
          <div
            aria-label={
              isSelected
                ? `Reorder ${visual.institutionName} wallet card`
                : undefined
            }
            className={cn(
              "absolute inset-x-0 w-full origin-top touch-none text-left transition-[transform,filter,opacity] duration-300 active:scale-[0.985]",
              isSelected ? "z-20 cursor-grab active:cursor-grabbing" : "z-10",
            )}
            data-account-card={visual.accountId}
            data-selected={isSelected ? "true" : "false"}
            key={visual.accountId}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (!isSelected) {
                return;
              }

              if (
                event.key === "ArrowDown" ||
                event.key === "PageDown" ||
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                cycleFrontCardToBack();
                return;
              }

              if (event.key === "ArrowUp" || event.key === "PageUp") {
                event.preventDefault();
                cycleBackCardToFront();
              }
            }}
            onPointerDown={(event) => {
              if (!isSelected) {
                return;
              }

              dragStartYRef.current = event.clientY;
              setDraggingAccountId(visual.accountId);
            }}
            onPointerMove={(event) => {
              if (!isSelected || draggingAccountId !== visual.accountId) {
                return;
              }

              const startY = dragStartYRef.current;

              if (startY === null) {
                return;
              }

              setDragDeltaY(event.clientY - startY);
            }}
            onPointerUp={releaseDrag}
            onPointerCancel={releaseDrag}
            role={isSelected ? "button" : undefined}
            style={{
              opacity: isSelected ? 1 : 0.96 - stackIndex * 0.12,
              transform: `translate3d(${offsetX}px, ${offsetY + dragLift}px, 0) scale(${scale}) rotate(${rotation + dragTilt}deg)`,
            }}
            tabIndex={isSelected ? 0 : -1}
          >
            <PocketWalletCard
              className={cn(
                "transition-[transform,box-shadow,filter] duration-300",
                isSelected
                  ? "shadow-[0_30px_48px_rgba(64,70,67,0.2)]"
                  : "shadow-[0_14px_26px_rgba(64,70,67,0.12)] brightness-[0.985]",
              )}
              hideSensitiveByDefault
              visual={visual}
            />
          </div>
        );
      })}
    </div>
  );
}

export function WalletTemplatePicker({
  selectedTemplateId,
  selectedAccentId,
  onSelectTemplate,
  onSelectAccent,
}: {
  selectedTemplateId: WalletCardTemplateId;
  selectedAccentId: WalletAccentId;
  onSelectTemplate: (templateId: WalletCardTemplateId) => void;
  onSelectAccent: (accentId: WalletAccentId) => void;
}) {
  const previewVisual = {
    accountId: "preview",
    institutionName: "Pocket Account",
    maskedAccountNumber: "•••• 4061",
    fullAccountNumber: "9038 4061 2208 7712",
    balanceMinor: 452000,
    iconName: "payments",
    templateId: selectedTemplateId,
    accentId: selectedAccentId,
    helperLabel: "Card Holder",
    tag: "Imran Khan",
    currencyLabel: "ETB" as const,
  };

  return (
    <div className="space-y-4">
      <PocketWalletCard
        className="mx-auto max-w-[22rem] rounded-[26px] p-4"
        visual={previewVisual}
      />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Templates
        </p>
        <div className="flex flex-wrap gap-2">
          {walletTemplateOptions.map((template) => (
            <button
              className={cn(
                "rounded-full border px-3 py-2 text-left transition active:scale-[0.98]",
                selectedTemplateId === template.id
                  ? "border-primary/35 bg-primary/8"
                  : "border-outline-variant/20 bg-surface",
              )}
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              type="button"
            >
              <p className="text-sm font-semibold text-on-surface">{template.title}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Color story
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {walletAccentPresets.map((accent) => (
            <button
              className={cn(
                "rounded-[18px] border p-2.5 text-left transition active:scale-[0.98]",
                selectedAccentId === accent.id
                  ? "border-primary/35 bg-primary/8"
                  : "border-outline-variant/20 bg-surface",
              )}
              key={accent.id}
              onClick={() => onSelectAccent(accent.id)}
              type="button"
            >
              <div className={cn("h-12 rounded-2xl border bg-gradient-to-r", accent.cardBase, accent.cardBorder)} />
              <p className="mt-2 text-sm font-semibold text-on-surface">{accent.label}</p>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">
                {formatCurrencyAmount(452000, { compact: true })} preview
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
