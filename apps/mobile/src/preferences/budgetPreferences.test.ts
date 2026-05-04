import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearBudgetWorkspacePreferences,
  getBudgetWorkspacePreferenceKey,
  persistBudgetWorkspacePreferences,
  readBudgetWorkspacePreferences,
} from "./budgetPreferences";

describe("budgetPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips budget visibility and limit overrides, including an intentionally empty visible set", () => {
    persistBudgetWorkspacePreferences({
      visibleBudgetIds: [],
      limitOverrides: {
        "budget-food": 125000,
        "budget-transport": 88000,
      },
    });

    expect(readBudgetWorkspacePreferences()).toEqual({
      version: 1,
      visibleBudgetIds: [],
      limitOverrides: {
        "budget-food": 125000,
        "budget-transport": 88000,
      },
    });
  });

  it("clears the persisted budget workspace payload", () => {
    persistBudgetWorkspacePreferences({
      visibleBudgetIds: ["budget-food"],
      limitOverrides: {
        "budget-food": 99000,
      },
    });

    clearBudgetWorkspacePreferences();

    expect(window.localStorage.getItem(getBudgetWorkspacePreferenceKey())).toBeNull();
    expect(readBudgetWorkspacePreferences()).toBeNull();
  });
});
