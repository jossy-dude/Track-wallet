import { useMemo, useState } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import { ModalWindow } from "./ModalWindow";
import { MotionStagger } from "./settingsMotionPrimitives";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface CategoryDraftInput {
  icon: string;
  name: string;
  description: string;
}

export function CategoryCreateWindow({
  isOpen,
  originLabel,
  existingCategories,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  originLabel: string;
  existingCategories: readonly {
    id: string;
    label: string;
    icon: string;
    description?: string;
  }[];
  onClose: () => void;
  onSubmit?: (draft: CategoryDraftInput) => void;
}) {
  const [selectedIcon, setSelectedIcon] = useState("category");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const normalizedName = name.trim().toLowerCase();
  const duplicateCategory = useMemo(
    () =>
      existingCategories.find(
        (category) => category.label.trim().toLowerCase() === normalizedName,
      ) ?? null,
    [existingCategories, normalizedName],
  );

  const iconOptions = [
    "category",
    "restaurant",
    "directions_car",
    "home",
    "payments",
    "theater_comedy",
    "shopping_bag",
    "medical_services",
    "school",
    "flight",
    "shopping_cart",
    "savings",
  ];

  function handleSubmit() {
    if (!onSubmit || normalizedName.length === 0 || duplicateCategory) {
      return;
    }

    onSubmit({
      icon: selectedIcon,
      name: name.trim(),
      description: description.trim(),
    });
    setName("");
    setDescription("");
    setSelectedIcon("category");
    onClose();
  }

  return (
    <ModalWindow
      isOpen={isOpen}
      onClose={onClose}
      subtitle={`Opened from ${originLabel}. Use the current category list to avoid duplicates before category persistence is added.`}
      title="Add Category"
    >
      <MotionStagger className="space-y-5" step={36} variant="subtle">
        <section className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            Existing categories
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {existingCategories.map((category) => (
              <div
                className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-on-surface"
                key={category.id}
              >
                <MaterialSymbol className="text-[15px] text-primary" filled name={category.icon} />
                {category.label}
              </div>
            ))}
          </div>
          {duplicateCategory ? (
            <p className="mt-3 text-sm font-medium text-error">
              “{duplicateCategory.label}” already exists in the tracked category set.
            </p>
          ) : null}
        </section>

        <section className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            Choose icon
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {iconOptions.map((icon) => {
              const isSelected = selectedIcon === icon;
              return (
                <button
                  aria-pressed={isSelected}
                  className={joinClasses(
                    "flex h-12 w-full items-center justify-center rounded-2xl border transition active:scale-[0.97]",
                    isSelected
                      ? "border-primary/30 bg-primary-container/30 text-primary"
                      : "border-outline-variant/18 bg-surface text-on-surface-variant",
                  )}
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  type="button"
                >
                  <MaterialSymbol filled={isSelected} name={icon} />
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Category name
            </span>
            <input
              className="w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
              onChange={(event) => setName(event.target.value)}
              placeholder="Utilities"
              type="text"
              value={name}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Description
            </span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional note for how this category should be used."
              value={description}
            />
          </label>
        </div>

        <div className="rounded-[24px] border border-dashed border-outline-variant/22 bg-background px-4 py-4">
          <p className="text-sm font-semibold text-on-surface">Current backend boundary</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            This window is live and reusable, but shared custom-category persistence is not wired
            yet. The form stays honest by checking duplicates against the current category set
            before a backend category store exists.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-outline-variant/18 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!onSubmit || normalizedName.length === 0 || duplicateCategory !== null}
            onClick={handleSubmit}
            type="button"
          >
            {onSubmit ? "Create category" : "Category storage pending"}
          </button>
        </div>
      </MotionStagger>
    </ModalWindow>
  );
}
