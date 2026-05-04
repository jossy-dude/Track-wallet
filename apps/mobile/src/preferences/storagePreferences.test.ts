import { beforeEach, describe, expect, it } from "vitest";

import {
  persistImportDuplicateModePreference,
  readImportDuplicateModePreference,
} from "./storagePreferences";

describe("storagePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads a stored duplicate review mode without collapsing it to skip", () => {
    persistImportDuplicateModePreference("review");

    expect(readImportDuplicateModePreference()).toBe("review");
  });
});
