import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { BottomNavigationItem } from "../types";

export interface BottomNavBarProps {
  items: readonly BottomNavigationItem[];
  className?: string;
}

export function BottomNavBar({ items, className }: BottomNavBarProps) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[24px] border-t border-stone-200/50 bg-background/95 px-4 pb-6 pt-3 backdrop-blur-md md:hidden",
        className
      )}
    >
      {items.map((item) => (
        <button
          aria-current={item.isActive ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center rounded-2xl px-4 py-1.5 transition-all active:scale-95",
            item.isActive
              ? "bg-primary/10 text-primary"
              : "text-stone-500 dark:text-stone-400"
          )}
          key={item.id}
          onClick={item.onPress}
          type="button"
        >
          <MaterialSymbol
            className="mb-1 text-2xl"
            filled={item.isActive}
            name={item.icon}
          />
          <span className="text-[11px] font-semibold">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
