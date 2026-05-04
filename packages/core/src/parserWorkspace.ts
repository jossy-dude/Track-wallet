import {
  cloneDefaultParserTemplates,
  findDefaultParserTemplate,
} from "./parserTemplates";
import type {
  AccountChannel,
  BuiltInParserTemplateDefinition,
  CustomParserTemplateDefinition,
  ParserAccountBinding,
  ParserBuiltInTemplateOverride,
  ParserRuntimeOptions,
  ParserTemplateDefinition,
  ParserTemplateEngineDefinition,
  ParserTemplateFamilyDefinition,
  ParserTemplateInspection,
  ParserTemplateInspectionBinding,
  ParserTemplateUserProfile,
  ParserTemplateWorkspace,
  TransactionCategory,
} from "./types";

function cloneUserProfile(
  userProfile: ParserTemplateUserProfile,
): ParserTemplateUserProfile {
  return {
    senderAliases: [...userProfile.senderAliases],
    accountIdentifiers: [...userProfile.accountIdentifiers],
    identityTextFragments: [...userProfile.identityTextFragments],
  };
}

function cloneAccountBinding(binding: ParserAccountBinding): ParserAccountBinding {
  return {
    ...binding,
    userProfile: cloneUserProfile(binding.userProfile),
  };
}

function createDefaultUserProfile(
  senderAliases: readonly string[],
): ParserTemplateUserProfile {
  return {
    senderAliases: [...senderAliases],
    accountIdentifiers: [],
    identityTextFragments: [],
  };
}

function normalizeTextList(values: readonly string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function normalizeLookupToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeUserProfile(
  userProfile: ParserTemplateUserProfile,
  fallbackSenderAliases: readonly string[],
): ParserTemplateUserProfile {
  const senderAliases = normalizeTextList(userProfile.senderAliases);

  return {
    senderAliases:
      senderAliases.length > 0
        ? senderAliases
        : normalizeTextList(fallbackSenderAliases),
    accountIdentifiers: normalizeTextList(userProfile.accountIdentifiers),
    identityTextFragments: normalizeTextList(userProfile.identityTextFragments),
  };
}

function normalizeAccountBinding(
  binding: ParserAccountBinding,
): ParserAccountBinding {
  return {
    ...binding,
    accountLabel: binding.accountLabel.trim(),
    institutionKey: binding.institutionKey.trim(),
    userProfile: normalizeUserProfile(binding.userProfile, []),
  };
}

function sameTextList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const normalizedLeft = normalizeTextList(left);
  const normalizedRight = normalizeTextList(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function sameUserProfile(
  left: ParserTemplateUserProfile,
  right: ParserTemplateUserProfile,
): boolean {
  return (
    sameTextList(left.senderAliases, right.senderAliases) &&
    sameTextList(left.accountIdentifiers, right.accountIdentifiers) &&
    sameTextList(left.identityTextFragments, right.identityTextFragments)
  );
}

function extractEngineDefinition(
  template: ParserTemplateDefinition,
): ParserTemplateEngineDefinition {
  return {
    regex: template.regex,
    direction: template.direction,
    amountKey: template.amountKey,
    merchantKey: template.merchantKey,
    balanceKey: template.balanceKey,
    feeKey: template.feeKey,
    vatKey: template.vatKey,
    extraFeeKey: template.extraFeeKey,
    totalKey: template.totalKey,
    accountKey: template.accountKey,
    referenceKey: template.referenceKey,
    titleKey: template.titleKey,
    dateKey: template.dateKey,
    timeKey: template.timeKey,
    meridiemKey: template.meridiemKey,
    dateMode: template.dateMode,
    accountChannel: template.accountChannel,
    category: template.category,
    preserveTitleCase: template.preserveTitleCase,
  };
}

function createBuiltInTemplateDefinition(
  template: ParserTemplateDefinition,
): BuiltInParserTemplateDefinition {
  return {
    id: template.id,
    financialInstitution: template.financialInstitution,
    institutionKey: template.institutionKey,
    institutionLabel: template.institutionLabel,
    institutionIcon: template.institutionIcon,
    name: template.name,
    version: template.version,
    updated: template.updated,
    defaultStatus: template.status === "disabled" ? "fallback" : template.status,
    note: template.note,
    healthScore: template.healthScore,
    engine: extractEngineDefinition(template),
    defaultUserProfile: createDefaultUserProfile(template.senderAliases),
  };
}

function defaultAccountChannel(
  template: Pick<ParserTemplateDefinition, "financialInstitution" | "accountChannel">,
): AccountChannel {
  if (template.accountChannel) {
    return template.accountChannel;
  }

  return template.financialInstitution === "telebirr" ||
    template.financialInstitution === "cbebirr"
    ? "mobile_money"
    : "bank";
}

function toResolvedTemplate(
  base: {
    id: string;
    financialInstitution: ParserTemplateDefinition["financialInstitution"];
    institutionKey: string;
    institutionLabel: string;
    institutionIcon: string;
    name: string;
    version: string;
    updated: string;
    status: ParserTemplateDefinition["status"];
    note: string;
    healthScore: number | null;
    sourceType: ParserTemplateDefinition["sourceType"];
    templateKind: ParserTemplateDefinition["templateKind"];
    builtInTemplateId?: string;
    linkedAccountId?: string;
    linkedAccountLabel?: string;
    engineEditable: boolean;
    userProfile: ParserTemplateUserProfile;
    engine: ParserTemplateEngineDefinition;
  },
): ParserTemplateDefinition {
  const userProfile = cloneUserProfile(base.userProfile);

  return {
    id: base.id,
    financialInstitution: base.financialInstitution,
    institutionKey: base.institutionKey,
    institutionLabel: base.institutionLabel,
    institutionIcon: base.institutionIcon,
    senderAliases: [...userProfile.senderAliases],
    accountIdentifiers: [...userProfile.accountIdentifiers],
    identityTextFragments: [...userProfile.identityTextFragments],
    name: base.name,
    version: base.version,
    updated: base.updated,
    status: base.status,
    regex: base.engine.regex,
    note: base.note,
    healthScore: base.healthScore,
    sourceType: base.sourceType,
    templateKind: base.templateKind,
    builtInTemplateId: base.builtInTemplateId,
    linkedAccountId: base.linkedAccountId,
    linkedAccountLabel: base.linkedAccountLabel,
    engineEditable: base.engineEditable,
    userProfile,
    direction: base.engine.direction,
    amountKey: base.engine.amountKey,
    merchantKey: base.engine.merchantKey,
    balanceKey: base.engine.balanceKey,
    feeKey: base.engine.feeKey,
    vatKey: base.engine.vatKey,
    extraFeeKey: base.engine.extraFeeKey,
    totalKey: base.engine.totalKey,
    accountKey: base.engine.accountKey,
    referenceKey: base.engine.referenceKey,
    titleKey: base.engine.titleKey,
    dateKey: base.engine.dateKey,
    timeKey: base.engine.timeKey,
    meridiemKey: base.engine.meridiemKey,
    dateMode: base.engine.dateMode,
    accountChannel: base.engine.accountChannel,
    category: base.engine.category,
    preserveTitleCase: base.engine.preserveTitleCase,
  };
}

function sameOptionalText(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}

function sameEngineDefinition(
  left: ParserTemplateDefinition,
  right: ParserTemplateDefinition,
): boolean {
  return (
    left.regex === right.regex &&
    left.direction === right.direction &&
    left.amountKey === right.amountKey &&
    sameOptionalText(left.merchantKey, right.merchantKey) &&
    sameOptionalText(left.balanceKey, right.balanceKey) &&
    sameOptionalText(left.feeKey, right.feeKey) &&
    sameOptionalText(left.vatKey, right.vatKey) &&
    sameOptionalText(left.extraFeeKey, right.extraFeeKey) &&
    sameOptionalText(left.totalKey, right.totalKey) &&
    sameOptionalText(left.accountKey, right.accountKey) &&
    sameOptionalText(left.referenceKey, right.referenceKey) &&
    sameOptionalText(left.titleKey, right.titleKey) &&
    sameOptionalText(left.dateKey, right.dateKey) &&
    sameOptionalText(left.timeKey, right.timeKey) &&
    sameOptionalText(left.meridiemKey, right.meridiemKey) &&
    left.dateMode === right.dateMode &&
    left.accountChannel === right.accountChannel &&
    left.category === right.category &&
    left.preserveTitleCase === right.preserveTitleCase
  );
}

function deriveCustomTemplateId(template: ParserTemplateDefinition): string {
  if (!findDefaultParserTemplate(template.id)) {
    return template.id;
  }

  return `${template.id}__custom`;
}

function buildBoundRuntimeTemplateId(
  templateId: string,
  accountId: string,
): string {
  return `${templateId}::${accountId}`;
}

function matchesBindingFamily(
  template: BuiltInParserTemplateDefinition,
  binding: ParserAccountBinding,
): boolean {
  return (
    normalizeLookupToken(template.institutionKey) ===
      normalizeLookupToken(binding.institutionKey) ||
    template.financialInstitution === binding.financialInstitution
  );
}

function createTemplateFamilyCatalog(
  templates: readonly BuiltInParserTemplateDefinition[],
): ParserTemplateFamilyDefinition[] {
  const familyMap = new Map<string, ParserTemplateFamilyDefinition>();

  for (const template of templates) {
    const key = normalizeLookupToken(template.institutionKey);
    const existing = familyMap.get(key);

    if (existing) {
      existing.templateIds.push(template.id);
      existing.templateCount = existing.templateIds.length;
      existing.defaultSenderAliases = normalizeTextList([
        ...existing.defaultSenderAliases,
        ...template.defaultUserProfile.senderAliases,
      ]);
      continue;
    }

    familyMap.set(key, {
      institutionKey: template.institutionKey,
      financialInstitution: template.financialInstitution,
      institutionLabel: template.institutionLabel,
      institutionIcon: template.institutionIcon,
      defaultSenderAliases: normalizeTextList(template.defaultUserProfile.senderAliases),
      templateIds: [template.id],
      templateCount: 1,
    });
  }

  return [...familyMap.values()].sort((left, right) =>
    left.institutionLabel.localeCompare(right.institutionLabel),
  );
}

function buildFamilyLookupTokens(
  family: ParserTemplateFamilyDefinition,
): string[] {
  return [
    family.institutionKey,
    family.institutionLabel,
    family.financialInstitution,
    ...family.defaultSenderAliases,
  ]
    .map(normalizeLookupToken)
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

const DEFAULT_BUILT_IN_PARSER_TEMPLATES = cloneDefaultParserTemplates().map(
  createBuiltInTemplateDefinition,
);
const DEFAULT_TEMPLATE_FAMILY_CATALOG = createTemplateFamilyCatalog(
  DEFAULT_BUILT_IN_PARSER_TEMPLATES,
);

export function cloneDefaultBuiltInParserTemplates(): BuiltInParserTemplateDefinition[] {
  return DEFAULT_BUILT_IN_PARSER_TEMPLATES.map((template) => ({
    ...template,
    defaultUserProfile: cloneUserProfile(template.defaultUserProfile),
    engine: { ...template.engine },
  }));
}

export function listBuiltInParserTemplateFamilies(): ParserTemplateFamilyDefinition[] {
  return DEFAULT_TEMPLATE_FAMILY_CATALOG.map((family) => ({
    ...family,
    defaultSenderAliases: [...family.defaultSenderAliases],
    templateIds: [...family.templateIds],
  }));
}

export function findBuiltInParserTemplateFamily(
  institutionKey: string,
): ParserTemplateFamilyDefinition | undefined {
  const family = DEFAULT_TEMPLATE_FAMILY_CATALOG.find(
    (entry) =>
      normalizeLookupToken(entry.institutionKey) ===
      normalizeLookupToken(institutionKey),
  );

  if (!family) {
    return undefined;
  }

  return {
    ...family,
    defaultSenderAliases: [...family.defaultSenderAliases],
    templateIds: [...family.templateIds],
  };
}

export function suggestBuiltInParserTemplateFamily(
  query: string,
): ParserTemplateFamilyDefinition | null {
  const normalizedQuery = normalizeLookupToken(query);

  if (!normalizedQuery) {
    return null;
  }

  const exactMatch = DEFAULT_TEMPLATE_FAMILY_CATALOG.find((family) =>
    buildFamilyLookupTokens(family).some((token) => token === normalizedQuery),
  );
  if (exactMatch) {
  return {
    ...exactMatch,
    defaultSenderAliases: [...exactMatch.defaultSenderAliases],
    templateIds: [...exactMatch.templateIds],
  };
  }

  const fuzzyMatch = DEFAULT_TEMPLATE_FAMILY_CATALOG.find((family) =>
    buildFamilyLookupTokens(family).some(
      (token) => token.includes(normalizedQuery) || normalizedQuery.includes(token),
    ),
  );
  if (!fuzzyMatch) {
    return null;
  }

  return {
    ...fuzzyMatch,
    defaultSenderAliases: [...fuzzyMatch.defaultSenderAliases],
    templateIds: [...fuzzyMatch.templateIds],
  };
}

export function findDefaultBuiltInParserTemplate(
  templateId: string,
): BuiltInParserTemplateDefinition | undefined {
  const template = DEFAULT_BUILT_IN_PARSER_TEMPLATES.find(
    (entry) => entry.id === templateId,
  );

  if (!template) {
    return undefined;
  }

  return {
    ...template,
    defaultUserProfile: cloneUserProfile(template.defaultUserProfile),
    engine: { ...template.engine },
  };
}

export function createDefaultParserTemplateWorkspace(): ParserTemplateWorkspace {
  return {
    version: 3,
    builtInOverrides: [],
    accountBindings: [],
    customTemplates: [],
  };
}

export function findParserAccountBinding(
  workspace: ParserTemplateWorkspace,
  accountId: string,
): ParserAccountBinding | undefined {
  const entry = workspace.accountBindings.find((binding) => binding.accountId === accountId);
  return entry ? cloneAccountBinding(entry) : undefined;
}

export function upsertParserAccountBinding(
  workspace: ParserTemplateWorkspace,
  binding: ParserAccountBinding,
): ParserTemplateWorkspace {
  const nextBinding = normalizeAccountBinding(binding);
  const nextBindings = workspace.accountBindings.some(
    (entry) => entry.accountId === nextBinding.accountId,
  )
    ? workspace.accountBindings.map((entry) =>
        entry.accountId === nextBinding.accountId ? nextBinding : cloneAccountBinding(entry),
      )
    : [...workspace.accountBindings.map(cloneAccountBinding), nextBinding];

  return {
    version: 3,
    builtInOverrides: workspace.builtInOverrides.map((entry) => ({
      ...entry,
      userProfile: cloneUserProfile(entry.userProfile),
    })),
    accountBindings: nextBindings,
    customTemplates: workspace.customTemplates.map((template) => ({
      ...template,
      userProfile: cloneUserProfile(template.userProfile),
      engine: { ...template.engine },
    })),
  };
}

export function removeParserAccountBinding(
  workspace: ParserTemplateWorkspace,
  accountId: string,
): ParserTemplateWorkspace {
  return {
    version: 3,
    builtInOverrides: workspace.builtInOverrides.map((entry) => ({
      ...entry,
      userProfile: cloneUserProfile(entry.userProfile),
    })),
    accountBindings: workspace.accountBindings
      .filter((entry) => entry.accountId !== accountId)
      .map(cloneAccountBinding),
    customTemplates: workspace.customTemplates.map((template) => ({
      ...template,
      userProfile: cloneUserProfile(template.userProfile),
      engine: { ...template.engine },
    })),
  };
}

export function resolveBuiltInParserTemplate(
  template: BuiltInParserTemplateDefinition,
  override?: ParserBuiltInTemplateOverride,
): ParserTemplateDefinition {
  const userProfile = normalizeUserProfile(
    override?.userProfile ?? template.defaultUserProfile,
    template.defaultUserProfile.senderAliases,
  );

  return toResolvedTemplate({
    id: template.id,
    financialInstitution: template.financialInstitution,
    institutionKey: template.institutionKey,
    institutionLabel: template.institutionLabel,
    institutionIcon: template.institutionIcon,
    name: template.name,
    version: template.version,
    updated: template.updated,
    status: override?.status ?? template.defaultStatus,
    note: template.note,
    healthScore: template.healthScore,
    sourceType: "core",
    templateKind: "builtin",
    builtInTemplateId: template.id,
    engineEditable: false,
    userProfile,
    engine: { ...template.engine },
  });
}

function resolveAccountBoundBuiltInParserTemplate(
  template: BuiltInParserTemplateDefinition,
  binding: ParserAccountBinding,
  override?: ParserBuiltInTemplateOverride,
): ParserTemplateDefinition {
  const fallbackSenderAliases =
    override?.userProfile.senderAliases.length &&
    normalizeTextList(override.userProfile.senderAliases).length > 0
      ? override.userProfile.senderAliases
      : template.defaultUserProfile.senderAliases;
  const userProfile = normalizeUserProfile(
    {
      senderAliases:
        binding.userProfile.senderAliases.length > 0
          ? binding.userProfile.senderAliases
          : fallbackSenderAliases,
      accountIdentifiers: binding.userProfile.accountIdentifiers,
      identityTextFragments: binding.userProfile.identityTextFragments,
    },
    fallbackSenderAliases,
  );

  return toResolvedTemplate({
    id: buildBoundRuntimeTemplateId(template.id, binding.accountId),
    financialInstitution: template.financialInstitution,
    institutionKey: template.institutionKey,
    institutionLabel: template.institutionLabel,
    institutionIcon: template.institutionIcon,
    name: template.name,
    version: template.version,
    updated: template.updated,
    status: binding.status,
    note: template.note,
    healthScore: template.healthScore,
    sourceType: "core",
    templateKind: "builtin",
    builtInTemplateId: template.id,
    linkedAccountId: binding.accountId,
    linkedAccountLabel: binding.accountLabel,
    engineEditable: false,
    userProfile,
    engine: { ...template.engine, accountChannel: binding.accountChannel },
  });
}

export function resolveCustomParserTemplate(
  template: CustomParserTemplateDefinition,
): ParserTemplateDefinition {
  const userProfile = normalizeUserProfile(
    template.userProfile,
    template.userProfile.senderAliases,
  );

  return toResolvedTemplate({
    id: template.id,
    financialInstitution: template.financialInstitution,
    institutionKey: template.institutionKey,
    institutionLabel: template.institutionLabel,
    institutionIcon: template.institutionIcon,
    name: template.name,
    version: template.version,
    updated: template.updated,
    status: template.status,
    note: template.note,
    healthScore: template.healthScore,
    sourceType: "local",
    templateKind: "custom",
    builtInTemplateId: template.builtInTemplateId,
    linkedAccountId: template.linkedAccountId,
    linkedAccountLabel: template.linkedAccountLabel,
    engineEditable: true,
    userProfile,
    engine: { ...template.engine },
  });
}

export function resolveParserTemplateWorkspace(
  workspace: ParserTemplateWorkspace,
): ParserTemplateDefinition[] {
  const overrideById = new Map(
    workspace.builtInOverrides.map((entry) => [entry.templateId, entry]),
  );
  const normalizedBindings = workspace.accountBindings.map(normalizeAccountBinding);

  const resolvedBuiltIns = DEFAULT_BUILT_IN_PARSER_TEMPLATES.flatMap((template) => {
    const matchingBindings = normalizedBindings.filter((binding) =>
      matchesBindingFamily(template, binding),
    );

    if (matchingBindings.length === 0) {
      return [resolveBuiltInParserTemplate(template, overrideById.get(template.id))];
    }

    return matchingBindings.map((binding) =>
      resolveAccountBoundBuiltInParserTemplate(
        template,
        binding,
        overrideById.get(template.id),
      ),
    );
  });
  const resolvedCustomTemplates = workspace.customTemplates.map(
    resolveCustomParserTemplate,
  );

  return [...resolvedBuiltIns, ...resolvedCustomTemplates];
}

export function buildParserRuntimeOptionsFromWorkspace(
  workspace: ParserTemplateWorkspace,
  options: Pick<ParserRuntimeOptions, "preferredTemplateId" | "includeDraftTemplates"> = {},
): ParserRuntimeOptions {
  return {
    templates: resolveParserTemplateWorkspace(workspace),
    preferredTemplateId: options.preferredTemplateId,
    includeDraftTemplates: options.includeDraftTemplates,
  };
}

function buildBinding(
  field: ParserTemplateInspectionBinding["field"],
  captureKey: string | undefined,
  required: boolean,
): ParserTemplateInspectionBinding {
  return {
    field,
    captureKey: captureKey?.trim() || null,
    required,
  };
}

export function inspectParserTemplate(
  template: ParserTemplateDefinition,
): ParserTemplateInspection {
  return {
    templateId: template.id,
    templateKind: template.templateKind,
    templateName: template.name,
    engineEditable: template.engineEditable,
    builtInTemplateId: template.builtInTemplateId ?? null,
    financialInstitution: template.financialInstitution,
    linkedAccountId: template.linkedAccountId ?? null,
    linkedAccountLabel: template.linkedAccountLabel ?? null,
    regex: template.regex,
    direction: template.direction,
    dateMode: template.dateMode,
    accountChannel: defaultAccountChannel(template),
    category: (template.category ?? null) as TransactionCategory | null,
    preserveTitleCase: Boolean(template.preserveTitleCase),
    userProfile: cloneUserProfile(template.userProfile),
    bindings: [
      buildBinding("amount", template.amountKey, true),
      buildBinding("merchant", template.merchantKey, false),
      buildBinding("balance", template.balanceKey, false),
      buildBinding("fee", template.feeKey, false),
      buildBinding("vat", template.vatKey, false),
      buildBinding("extra_fee", template.extraFeeKey, false),
      buildBinding("total", template.totalKey, false),
      buildBinding("account", template.accountKey, false),
      buildBinding("reference", template.referenceKey, false),
      buildBinding("title", template.titleKey, false),
      buildBinding("date", template.dateKey, template.dateMode === "message_date"),
      buildBinding("time", template.timeKey, false),
      buildBinding("meridiem", template.meridiemKey, false),
    ],
  };
}

export function migrateResolvedTemplatesToWorkspace(
  templates: readonly ParserTemplateDefinition[],
): ParserTemplateWorkspace {
  const builtInOverrides: ParserBuiltInTemplateOverride[] = [];
  const accountBindingMap = new Map<string, ParserAccountBinding>();
  const customTemplates: CustomParserTemplateDefinition[] = [];

  for (const template of templates) {
    const builtInTemplate = findDefaultParserTemplate(
      template.builtInTemplateId ?? template.id,
    );

    if (
      template.linkedAccountId &&
      builtInTemplate &&
      template.templateKind === "builtin"
    ) {
      if (!accountBindingMap.has(template.linkedAccountId)) {
        accountBindingMap.set(template.linkedAccountId, {
          accountId: template.linkedAccountId,
          accountLabel: template.linkedAccountLabel ?? template.linkedAccountId,
          accountChannel: defaultAccountChannel(template),
          financialInstitution: template.financialInstitution,
          institutionKey: template.institutionKey,
          status: template.status,
          userProfile: normalizeUserProfile(
            {
              senderAliases: template.senderAliases,
              accountIdentifiers: template.accountIdentifiers ?? [],
              identityTextFragments: template.identityTextFragments ?? [],
            },
            builtInTemplate.senderAliases,
          ),
        });
      }
      continue;
    }

    if (
      builtInTemplate &&
      template.sourceType === "core" &&
      sameEngineDefinition(template, builtInTemplate)
    ) {
      const normalizedUserProfile = normalizeUserProfile(
        {
          senderAliases:
            template.senderAliases.length > 0
              ? template.senderAliases
              : builtInTemplate.senderAliases,
          accountIdentifiers: template.accountIdentifiers ?? [],
          identityTextFragments: template.identityTextFragments ?? [],
        },
        builtInTemplate.senderAliases,
      );
      const defaultBuiltInUserProfile = normalizeUserProfile(
        {
          senderAliases: builtInTemplate.senderAliases,
          accountIdentifiers: builtInTemplate.accountIdentifiers ?? [],
          identityTextFragments: builtInTemplate.identityTextFragments ?? [],
        },
        builtInTemplate.senderAliases,
      );

      if (
        template.status !== builtInTemplate.status ||
        !sameUserProfile(normalizedUserProfile, defaultBuiltInUserProfile)
      ) {
        builtInOverrides.push({
          templateId: template.id,
          status: template.status,
          userProfile: normalizedUserProfile,
        });
      }
      continue;
    }

    customTemplates.push({
      id: deriveCustomTemplateId(template),
      financialInstitution: template.financialInstitution,
      institutionKey: template.institutionKey,
      institutionLabel: template.institutionLabel,
      institutionIcon: template.institutionIcon,
      name: template.name,
      version: template.version,
      updated: template.updated,
      status: template.status,
      note: template.note,
      healthScore: template.healthScore,
      sourceType: "local",
      builtInTemplateId: template.builtInTemplateId,
      userProfile: normalizeUserProfile(
        {
          senderAliases: template.senderAliases,
          accountIdentifiers: template.accountIdentifiers ?? [],
          identityTextFragments: template.identityTextFragments ?? [],
        },
        template.senderAliases,
      ),
      engine: extractEngineDefinition(template),
      linkedAccountId: template.linkedAccountId,
      linkedAccountLabel: template.linkedAccountLabel,
    });
  }

  return {
    version: 3,
    builtInOverrides,
    accountBindings: [...accountBindingMap.values()].map(cloneAccountBinding),
    customTemplates,
  };
}
