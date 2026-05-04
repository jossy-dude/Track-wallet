import { describe, expect, it } from "vitest";

import { parseSmsMessage } from "./parser";
import {
  buildParserRuntimeOptionsFromWorkspace,
  createDefaultParserTemplateWorkspace,
  inspectParserTemplate,
  migrateResolvedTemplatesToWorkspace,
  resolveParserTemplateWorkspace,
} from "./parserWorkspace";
import type {
  CustomParserTemplateDefinition,
  ParserTemplateDefinition,
  RawSmsMessage,
} from "./types";

function createRawSmsMessage(overrides: Partial<RawSmsMessage> = {}): RawSmsMessage {
  return {
    messageId: "sms-001",
    senderLabel: "CBE",
    smsBody:
      "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
    receivedAt: "2026-04-29T08:10:00.000Z",
    ...overrides,
  };
}

function createCustomTemplate(): CustomParserTemplateDefinition {
  return {
    id: "custom_local_template_v1",
    financialInstitution: "cbe",
    institutionKey: "CBE",
    institutionLabel: "Commercial Bank of Ethiopia",
    institutionIcon: "account_balance",
    name: "Custom Local Template",
    version: "v0.1.0",
    updated: "Local draft",
    status: "draft",
    note: "Custom local parser route.",
    healthScore: null,
    sourceType: "local",
    userProfile: {
      senderAliases: ["CBE-LAB"],
      accountIdentifiers: ["4920"],
      identityTextFragments: ["LAB"],
    },
    engine: {
      regex:
        "LAB amount\\s(?<amount>[\\d,.]+)\\smerchant\\s(?<merchant>.+?)\\sbalance\\s(?<balance>[\\d,.]+)",
      direction: "debit",
      amountKey: "amount",
      merchantKey: "merchant",
      balanceKey: "balance",
      dateMode: "captured_at",
    },
  };
}

describe("parser workspace architecture", () => {
  it("resolves immutable built-ins plus optional custom templates into runtime templates", () => {
    const workspace = createDefaultParserTemplateWorkspace();
    workspace.accountBindings.push({
      accountId: "acct-cbe-4920",
      accountLabel: "CBE Personal 4920",
      accountChannel: "bank",
      financialInstitution: "cbe",
      institutionKey: "CBE",
      status: "active",
      userProfile: {
        senderAliases: ["CBE-ALT"],
        accountIdentifiers: ["4920"],
        identityTextFragments: ["GROCERY"],
      },
    });
    workspace.customTemplates.push(createCustomTemplate());

    const resolvedTemplates = resolveParserTemplateWorkspace(workspace);
    const builtInTemplate = resolvedTemplates.find(
      (template) => template.id === "cbe_debit_v1::acct-cbe-4920",
    );
    const customTemplate = resolvedTemplates.find(
      (template) => template.id === "custom_local_template_v1",
    );

    expect(
      resolvedTemplates.some((template) => template.id === "cbe_debit_v1"),
    ).toBe(false);
    expect(builtInTemplate).toMatchObject({
      templateKind: "builtin",
      engineEditable: false,
      linkedAccountId: "acct-cbe-4920",
      linkedAccountLabel: "CBE Personal 4920",
      builtInTemplateId: "cbe_debit_v1",
      senderAliases: ["CBE-ALT"],
      accountIdentifiers: ["4920"],
      identityTextFragments: ["GROCERY"],
    });
    expect(customTemplate).toMatchObject({
      templateKind: "custom",
      engineEditable: true,
      senderAliases: ["CBE-LAB"],
    });
  });

  it("uses built-in parser logic while honoring user sender and account overrides", () => {
    const workspace = createDefaultParserTemplateWorkspace();
    workspace.accountBindings.push({
      accountId: "acct-cbe-4920",
      accountLabel: "CBE Personal 4920",
      accountChannel: "bank",
      financialInstitution: "cbe",
      institutionKey: "CBE",
      status: "active",
      userProfile: {
        senderAliases: ["CBE-ALT"],
        accountIdentifiers: ["4920"],
        identityTextFragments: [],
      },
    });

    const matchingMessage = createRawSmsMessage({
      senderLabel: "CBE-ALT",
    });
    const nonMatchingAccountMessage = createRawSmsMessage({
      messageId: "sms-002",
      senderLabel: "CBE-ALT",
      smsBody:
        "CBE ALERT: Your account 7001 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
    });

    const runtimeOptions = buildParserRuntimeOptionsFromWorkspace(workspace);

    expect(parseSmsMessage(matchingMessage, runtimeOptions).status).toBe("matched");
    expect(parseSmsMessage(nonMatchingAccountMessage, runtimeOptions)).toEqual({
      status: "unmatched",
      failureReason: "no_template_match",
      rawMessageId: "sms-002",
      senderLabel: "CBE-ALT",
      smsBody:
        "CBE ALERT: Your account 7001 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
    });
  });

  it("resolves multiple account bindings for the same built-in family without collisions", () => {
    const workspace = createDefaultParserTemplateWorkspace();
    workspace.accountBindings.push(
      {
        accountId: "acct-cbe-4920",
        accountLabel: "CBE Personal 4920",
        accountChannel: "bank",
        financialInstitution: "cbe",
        institutionKey: "CBE",
        status: "active",
        userProfile: {
          senderAliases: ["CBE"],
          accountIdentifiers: ["4920"],
          identityTextFragments: [],
        },
      },
      {
        accountId: "acct-cbe-7001",
        accountLabel: "CBE Savings 7001",
        accountChannel: "bank",
        financialInstitution: "cbe",
        institutionKey: "CBE",
        status: "active",
        userProfile: {
          senderAliases: ["CBE"],
          accountIdentifiers: ["7001"],
          identityTextFragments: [],
        },
      },
    );

    const resolvedTemplates = resolveParserTemplateWorkspace(workspace);
    const debitTemplateIds = resolvedTemplates
      .filter((template) => template.builtInTemplateId === "cbe_debit_v1")
      .map((template) => template.id);

    expect(debitTemplateIds).toEqual([
      "cbe_debit_v1::acct-cbe-4920",
      "cbe_debit_v1::acct-cbe-7001",
    ]);
  });

  it("exposes a structured inspection model for parser code/extraction surfaces", () => {
    const [template] = resolveParserTemplateWorkspace(createDefaultParserTemplateWorkspace());
    if (!template) {
      throw new Error("Expected at least one resolved template");
    }

    const inspection = inspectParserTemplate(template);

    expect(inspection.templateId).toBe(template.id);
    expect(inspection.engineEditable).toBe(false);
    expect(inspection.userProfile.senderAliases.length).toBeGreaterThan(0);
    expect(inspection.bindings).toContainEqual({
      field: "amount",
      captureKey: "amount",
      required: true,
    });
  });

  it("migrates legacy edited built-ins into custom templates instead of mutating the core catalog", () => {
    const legacyTemplates: ParserTemplateDefinition[] = [
      {
        ...resolveParserTemplateWorkspace(createDefaultParserTemplateWorkspace())[0]!,
        regex: "edited built in regex",
        sourceType: "local",
        templateKind: "custom",
        engineEditable: true,
      },
    ];

    const migrated = migrateResolvedTemplatesToWorkspace(legacyTemplates);

    expect(migrated.builtInOverrides).toEqual([]);
    expect(migrated.accountBindings).toEqual([]);
    expect(migrated.customTemplates).toHaveLength(1);
    expect(migrated.customTemplates[0]?.id).toBe("cbe_debit_v1__custom");
  });
});
