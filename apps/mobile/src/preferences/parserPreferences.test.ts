import { beforeEach, describe, expect, it } from "vitest";

import type { ParserWorkspaceAuthorityState } from "@omni-sync/core";
import { transactionStore } from "@omni-sync/database";

import {
  clearParserWorkspacePreferences,
  createDefaultParserWorkspacePreferenceSnapshot,
  persistParserWorkspacePreferences,
  readParserWorkspacePreferences,
} from "./parserPreferences";

const LEGACY_PARSER_WORKSPACE_STORAGE_KEY =
  "trackwallet.mobile.parser-workspace";

function toAuthorityState(
  snapshot = createDefaultParserWorkspacePreferenceSnapshot(),
): ParserWorkspaceAuthorityState {
  return {
    version: 1,
    templateWorkspace: snapshot.templateWorkspace,
    selectedTemplateId: snapshot.selectedTemplateId,
    senderLabel: snapshot.senderLabel,
    strictSchemaParsing: snapshot.strictSchemaParsing,
    preserveRawSms: snapshot.preserveRawSms,
    autoReconciliation: snapshot.autoReconciliation,
    verboseLogging: snapshot.verboseLogging,
  };
}

describe("parserPreferences", () => {
  beforeEach(() => {
    transactionStore.getState().clearAllData();
    window.localStorage.clear();
  });

  it("reads the shared parser workspace authority and clears stale legacy storage", () => {
    const authorityState = toAuthorityState();
    window.localStorage.setItem(
      LEGACY_PARSER_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        templateWorkspace: {
          version: 3,
          builtInOverrides: [],
          accountBindings: [],
          customTemplates: [],
        },
        selectedTemplateId: "stale-parser-template",
        senderLabel: "STALE",
        strictSchemaParsing: false,
        preserveRawSms: false,
        autoReconciliation: false,
        verboseLogging: true,
      }),
    );
    transactionStore
      .getState()
      .setParserWorkspaceAuthorityState(authorityState);

    const snapshot = readParserWorkspacePreferences();

    expect(snapshot).toMatchObject({
      version: 3,
      selectedTemplateId: authorityState.selectedTemplateId,
      senderLabel: authorityState.senderLabel,
      strictSchemaParsing: authorityState.strictSchemaParsing,
      preserveRawSms: authorityState.preserveRawSms,
      autoReconciliation: authorityState.autoReconciliation,
      verboseLogging: authorityState.verboseLogging,
    });
    expect(
      window.localStorage.getItem(LEGACY_PARSER_WORKSPACE_STORAGE_KEY),
    ).toBeNull();
  });

  it("migrates a legacy parser workspace into authority state and removes the legacy key", () => {
    window.localStorage.setItem(
      LEGACY_PARSER_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        templates: [
          {
            id: "telebirr_local_v1",
            institutionKey: "127",
            institutionLabel: "Telebirr",
            institutionIcon: "account_balance_wallet",
            name: "Telebirr Local Draft",
            version: "v0.2.0",
            updated: "Updated just now",
            status: "draft",
            regex: "ETB\\\\s(?<amount>[\\\\d,]+\\\\.\\\\d{2})",
            note: "Locally persisted template draft.",
            healthScore: null,
            sourceType: "local",
          },
        ],
        selectedTemplateId: "telebirr_local_v1",
        senderLabel: "127",
        strictSchemaParsing: false,
        preserveRawSms: true,
        autoReconciliation: true,
        verboseLogging: true,
      }),
    );

    const snapshot = readParserWorkspacePreferences();

    expect(snapshot).toMatchObject({
      version: 3,
      selectedTemplateId: "telebirr_local_v1",
      senderLabel: "127",
      strictSchemaParsing: false,
      preserveRawSms: true,
      autoReconciliation: true,
      verboseLogging: true,
    });
    expect(
      transactionStore.getState().parserWorkspaceAuthorityState,
    ).toMatchObject({
      version: 1,
      selectedTemplateId: "telebirr_local_v1",
      senderLabel: "127",
      strictSchemaParsing: false,
      preserveRawSms: true,
      autoReconciliation: true,
      verboseLogging: true,
    });
    expect(
      window.localStorage.getItem(LEGACY_PARSER_WORKSPACE_STORAGE_KEY),
    ).toBeNull();
  });

  it("persists parser workspace changes into authority state instead of local storage", () => {
    const snapshot = {
      ...createDefaultParserWorkspacePreferenceSnapshot(),
      senderLabel: "AUTH",
      verboseLogging: true,
    };

    window.localStorage.setItem(
      LEGACY_PARSER_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ stale: true }),
    );

    persistParserWorkspacePreferences(snapshot);

    expect(
      transactionStore.getState().parserWorkspaceAuthorityState,
    ).toMatchObject({
      version: 1,
      selectedTemplateId: snapshot.selectedTemplateId,
      senderLabel: "AUTH",
      verboseLogging: true,
    });
    expect(
      window.localStorage.getItem(LEGACY_PARSER_WORKSPACE_STORAGE_KEY),
    ).toBeNull();
  });

  it("clears both authority state and the legacy parser workspace key", () => {
    transactionStore
      .getState()
      .setParserWorkspaceAuthorityState(toAuthorityState());
    window.localStorage.setItem(
      LEGACY_PARSER_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ stale: true }),
    );

    clearParserWorkspacePreferences();

    expect(transactionStore.getState().parserWorkspaceAuthorityState).toBeNull();
    expect(
      window.localStorage.getItem(LEGACY_PARSER_WORKSPACE_STORAGE_KEY),
    ).toBeNull();
  });
});
