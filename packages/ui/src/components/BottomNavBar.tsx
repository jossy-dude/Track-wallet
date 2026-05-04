import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { BottomNavigationItem } from "../types";

export interface BottomNavBarProps {
  items: readonly BottomNavigationItem[];
  className?: string;
  styleVariant?: "detached" | "connected";
}

function NavItemButton({ item }: { item: BottomNavigationItem }) {
  return (
    <button
      aria-current={item.isActive ? "page" : undefined}
      className={cn(
        "tw-mobile-nav-item flex min-h-[52px] min-w-[62px] flex-1 flex-col items-center justify-center rounded-[18px] px-2 py-1 transition-all duration-200 hover:-translate-y-0.5 active:scale-95",
        item.isActive
          ? "bg-primary-container/45 text-primary shadow-[0_10px_20px_rgba(34,82,54,0.14)]"
          : "text-on-surface-variant",
      )}
      key={item.id}
      onClick={item.onPress}
      type="button"
    >
      <MaterialSymbol
        className="mb-1 text-[22px]"
        filled={item.isActive}
        name={item.icon}
      />
      <span className="text-[10px] font-semibold tracking-[0.04em]">
        {item.label}
      </span>
    </button>
  );
}

function ActionButton({
  item,
  className,
}: {
  item: BottomNavigationItem;
  className?: string;
}) {
  return (
    <>
      <style>
        {`
          @keyframes track-wallet-nav-scan {
            0%, 100% { transform: scale(0.92); opacity: 0.24; }
            50% { transform: scale(1.08); opacity: 0.48; }
          }
        `}
      </style>
      <div className="pointer-events-none absolute bottom-4 h-[78px] w-[78px] rounded-full bg-[radial-gradient(circle,rgba(87,132,101,0.24),rgba(87,132,101,0))] blur-xl" />
      <div
        className="pointer-events-none absolute bottom-[6px] h-[54px] w-[54px] rounded-full border border-white/18"
        style={{ animation: "track-wallet-nav-scan 2.6s ease-in-out infinite" }}
      />
      <button
        aria-label={item.label}
        aria-current={item.isActive ? "page" : undefined}
        className={cn(
          "tw-mobile-nav-item relative flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#5b9468,#4a7c59)] text-on-primary shadow-[0_18px_34px_rgba(34,82,54,0.28)] transition-all duration-200 hover:-translate-y-1 active:scale-95",
          className,
        )}
        key={item.id}
        onClick={item.onPress}
        type="button"
      >
        <span className="pointer-events-none absolute inset-[6px] rounded-full border border-white/42" />
        <MaterialSymbol className="text-[20px]" filled name={item.icon} />
        <span className="sr-only">{item.label}</span>
      </button>
    </>
  );
}

function DetachedBottomNav({
  actionItem,
  className,
  leftItems,
  rightItems,
}: {
  actionItem: BottomNavigationItem | null;
  className?: string;
  leftItems: readonly BottomNavigationItem[];
  rightItems: readonly BottomNavigationItem[];
}) {
  return (
    <nav
      className={cn(
        "tw-mobile-bottom-nav-enter fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-5 pt-4 md:hidden",
        className,
      )}
    >
      <div className="relative w-full max-w-[390px]">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-end gap-3">
          <div className="flex min-h-[68px] items-end justify-evenly rounded-[30px] border border-outline-variant/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,239,231,0.95))] px-2 pb-2 pt-3 shadow-[0_18px_42px_rgba(34,38,36,0.14)] backdrop-blur-xl">
            {leftItems.map((item) => (
              <NavItemButton item={item} key={item.id} />
            ))}
          </div>

          <div className="relative flex items-end justify-center">
            {actionItem ? (
              <ActionButton
                className="-mb-1 ring-[6px] ring-background"
                item={actionItem}
              />
            ) : null}
          </div>

          <div className="flex min-h-[68px] items-end justify-evenly rounded-[30px] border border-outline-variant/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,239,231,0.95))] px-2 pb-2 pt-3 shadow-[0_18px_42px_rgba(34,38,36,0.14)] backdrop-blur-xl">
            {rightItems.map((item) => (
              <NavItemButton item={item} key={item.id} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

function ConnectedBottomNav({
  actionItem,
  className,
  leftItems,
  rightItems,
}: {
  actionItem: BottomNavigationItem | null;
  className?: string;
  leftItems: readonly BottomNavigationItem[];
  rightItems: readonly BottomNavigationItem[];
}) {
  return (
    <nav
      className={cn(
        "tw-mobile-bottom-nav-enter fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-5 pt-4 md:hidden",
        className,
      )}
    >
      <div className="relative w-full max-w-[390px]">
        <div className="relative pt-3">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px] rounded-[32px] border border-outline-variant/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,239,231,0.95))] shadow-[0_18px_42px_rgba(34,38,36,0.14)] backdrop-blur-xl" />
          <div className="pointer-events-none absolute left-1/2 top-[-15px] h-[84px] w-[84px] -translate-x-1/2 rounded-full bg-background" />
          <div className="pointer-events-none absolute left-1/2 top-[-14px] h-[84px] w-[84px] -translate-x-1/2 rounded-full shadow-[0_0_0_1px_rgba(196,200,188,0.18)]" />

          <div className="relative grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-end gap-2 px-2 pb-2 pt-2">
            <div className="flex min-h-[68px] items-end justify-evenly px-1">
              {leftItems.map((item) => (
                <NavItemButton item={item} key={item.id} />
              ))}
            </div>

            <div className="relative flex items-start justify-center">
              {actionItem ? (
                <ActionButton
                  className="-mt-2 ring-[8px] ring-background"
                  item={actionItem}
                />
              ) : null}
            </div>

            <div className="flex min-h-[68px] items-end justify-evenly px-1">
              {rightItems.map((item) => (
                <NavItemButton item={item} key={item.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function BottomNavBar({
  items,
  className,
  styleVariant = "detached",
}: BottomNavBarProps) {
  const actionIndex = items.findIndex((item) => item.kind === "action");
  const actionItem = actionIndex >= 0 ? items[actionIndex] : null;
  const leftItems =
    actionIndex >= 0
      ? items.slice(0, actionIndex)
      : items.slice(0, Math.ceil(items.length / 2));
  const rightItems =
    actionIndex >= 0
      ? items.slice(actionIndex + 1)
      : items.slice(Math.ceil(items.length / 2));

  if (styleVariant === "connected") {
    return (
      <ConnectedBottomNav
        actionItem={actionItem}
        className={className}
        leftItems={leftItems}
        rightItems={rightItems}
      />
    );
  }

  return (
    <DetachedBottomNav
      actionItem={actionItem}
      className={className}
      leftItems={leftItems}
      rightItems={rightItems}
    />
  );
}
