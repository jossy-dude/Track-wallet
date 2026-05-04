import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  buildParserRuntimeOptionsFromWorkspace,
  createDefaultParserTemplateWorkspace,
  findBuiltInParserTemplateFamily,
  inspectParserTemplate,
  listBuiltInParserTemplateFamilies,
  migrateResolvedTemplatesToWorkspace,
  removeParserAccountBinding,
  resolveParserTemplateWorkspace,
  suggestBuiltInParserTemplateFamily,
  upsertParserAccountBinding,
  type AccountSummary,
  type ParserMatchResult,
  type ParserAccountBinding,
  type ParserTemplateDefinition,
  type ParserTemplateFamilyDefinition,
  type ParserTemplateInspectionBinding,
  type TransactionDirection,
} from "@omni-sync/core";
import { useTransactionStore } from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPanel,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import { useParser } from "../hooks/useParser";
import { useSmsCaptureRuntime } from "../sms";
import {
  clearParserWorkspacePreferences,
  persistParserWorkspacePreferences,
  readParserWorkspacePreferences,
} from "../preferences/parserPreferences";

type AppTabId = "home" | "inbox" | "ledger" | "accounts";
type ParserTabId = "templates" | "sandbox" | "diagnostics";
type SampleSource = "capture" | "manual";

interface ParsingWorkspacePageProps {
  onOpenTab?: (tabId: AppTabId) => void;
}

interface TemplateProfileDraft {
  name: string;
  senderAliases: string;
  accountIdentifiers: string;
  identityTextFragments: string;
}

interface ManagedParserAccount extends AccountSummary {
  note?: string;
}

const parserSandboxFallbackSamples: Record<string, string> = {
  CBE: "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
  DashenBank:
    "Dashen Alert: ETB 1,250.00 debited from account 7788 on 2026-04-28 at FUEL STATION. Available balance ETB 19,880.00",
  127: "Telebirr: ETB 320.00 paid to COFFEE SHOP from wallet 0172 on 2026-04-28. Current balance ETB 1,880.00",
  BOA: "BOA ALERT: ETB 980.00 credited to account 2104 on 2026-04-27 from CLIENT PAYMENT. Bal ETB 15,420.00",
  CBEBirr:
    "You have withdrawn 500.00Br from CBE ATM. charge 5.00Br tax 0.75Br. balance is 1,244.25Br",
  BunnaBank:
    "Bunna alert: ETB 215.00 debited from account 1633 on 2026-04-26 at TAXI FARE. Bal ETB 5,615.00",
};

const bindingLabels: Record<ParserTemplateInspectionBinding["field"], string> = {
  amount: "Amount",
  merchant: "Merchant",
  balance: "Balance",
  fee: "Fee",
  vat: "VAT",
  extra_fee: "Extra fee",
  total: "Total",
  account: "Account",
  reference: "Reference",
  title: "Title",
  date: "Date",
  time: "Time",
  meridiem: "Meridiem",
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);
}

function buildProfileDraft(template: ParserTemplateDefinition): TemplateProfileDraft {
  return {
    name: template.name,
    senderAliases: template.senderAliases.join(", "),
    accountIdentifiers: template.accountIdentifiers.join(", "),
    identityTextFragments: template.identityTextFragments.join(", "),
  };
}

function buildAccountIdentifierFallback(account: ManagedParserAccount | null): string[] {
  if (!account) {
    return [];
  }

  const digits = account.maskedAccountNumber.replace(/\D/g, "").slice(-4);
  return digits ? [digits] : [];
}

function buildBindingDraft(
  binding: ParserAccountBinding | null,
  account: ManagedParserAccount | null,
  family: ParserTemplateFamilyDefinition | null,
  template: ParserTemplateDefinition | null,
): TemplateProfileDraft {
  if (binding) {
    return {
      name: template?.name ?? family?.institutionLabel ?? account?.institutionName ?? "Parser setup",
      senderAliases: binding.userProfile.senderAliases.join(", "),
      accountIdentifiers: binding.userProfile.accountIdentifiers.join(", "),
      identityTextFragments: binding.userProfile.identityTextFragments.join(", "),
    };
  }

  return {
    name: template?.name ?? family?.institutionLabel ?? account?.institutionName ?? "Parser setup",
    senderAliases: family?.defaultSenderAliases.join(", ") ?? "",
    accountIdentifiers: buildAccountIdentifierFallback(account).join(", "),
    identityTextFragments: "",
  };
}

function getFallbackSampleForTemplate(template: ParserTemplateDefinition | null): string {
  if (!template) {
    return parserSandboxFallbackSamples.CBE;
  }

  return (
    parserSandboxFallbackSamples[template.institutionKey] ??
    parserSandboxFallbackSamples[template.senderAliases[0] ?? ""] ??
    parserSandboxFallbackSamples.CBE
  );
}

function updateTemplateField(
  template: ParserTemplateDefinition,
  field: ParserTemplateInspectionBinding["field"],
  value: string,
): ParserTemplateDefinition {
  const nextValue = value.trim();

  switch (field) {
    case "amount":
      return { ...template, amountKey: nextValue || "amount" };
    case "merchant":
      return { ...template, merchantKey: nextValue || undefined };
    case "balance":
      return { ...template, balanceKey: nextValue || undefined };
    case "fee":
      return { ...template, feeKey: nextValue || undefined };
    case "vat":
      return { ...template, vatKey: nextValue || undefined };
    case "extra_fee":
      return { ...template, extraFeeKey: nextValue || undefined };
    case "total":
      return { ...template, totalKey: nextValue || undefined };
    case "account":
      return { ...template, accountKey: nextValue || undefined };
    case "reference":
      return { ...template, referenceKey: nextValue || undefined };
    case "title":
      return { ...template, titleKey: nextValue || undefined };
    case "date":
      return { ...template, dateKey: nextValue || undefined };
    case "time":
      return { ...template, timeKey: nextValue || undefined };
    case "meridiem":
      return { ...template, meridiemKey: nextValue || undefined };
    default:
      return template;
  }
}

function buildCustomTemplateSeed(
  template: ParserTemplateDefinition,
): ParserTemplateDefinition {
  const createdAt = Date.now();
  const senderAliases =
    template.userProfile.senderAliases.length > 0
      ? template.userProfile.senderAliases
      : template.senderAliases;

  return {
    ...template,
    id: `${template.institutionKey.toLowerCase()}_custom_${createdAt}`,
    name: `${template.institutionLabel} Custom Draft`,
    updated: "Draft",
    status: "draft",
    sourceType: "local",
    templateKind: "custom",
    builtInTemplateId:
      template.templateKind === "builtin"
        ? template.id
        : template.builtInTemplateId,
    engineEditable: true,
    regex: template.regex,
    senderAliases: [...senderAliases],
    accountIdentifiers: [...template.accountIdentifiers],
    identityTextFragments: [...template.identityTextFragments],
    userProfile: {
      senderAliases: [...senderAliases],
      accountIdentifiers: [...template.accountIdentifiers],
      identityTextFragments: [...template.identityTextFragments],
    },
    note: "Custom parser draft branched from the selected template engine.",
  };
}

function formatDirectionLabel(direction: TransactionDirection) {
  if (direction === "credit") {
    return "Credit";
  }
  if (direction === "transfer") {
    return "Transfer";
  }

  return "Debit";
}

function formatFailureReason(result: Extract<ParserMatchResult, { status: "unmatched" }>) {
  if (result.failureReason === "no_template_match") {
    return "No template matched this sender/profile/sample combination.";
  }

  return result.failureReason;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatParserOutcomeLabel(outcome: string) {
  switch (outcome) {
    case "queued":
      return "Queued to inbox";
    case "unmatched":
      return "Stayed unmatched";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export function ParsingWorkspacePage({
  onOpenTab = () => undefined,
}: ParsingWorkspacePageProps) {
  const defaultTemplates = useMemo(
    () => resolveParserTemplateWorkspace(createDefaultParserTemplateWorkspace()),
    [],
  );
  const savedWorkspace = useMemo(() => readParserWorkspacePreferences(), []);
  const persistedTemplates = useMemo(
    () =>
      savedWorkspace
        ? resolveParserTemplateWorkspace(savedWorkspace.templateWorkspace)
        : defaultTemplates,
    [defaultTemplates, savedWorkspace],
  );
  const [templates, setTemplates] = useState<ParserTemplateDefinition[]>(
    () => persistedTemplates,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => savedWorkspace?.selectedTemplateId ?? persistedTemplates[0]?.id ?? "",
  );
  const [activeTab, setActiveTab] = useState<ParserTabId>("templates");
  const [strictSchemaParsing, setStrictSchemaParsing] = useState(
    savedWorkspace?.strictSchemaParsing ?? true,
  );
  const [preserveRawSms, setPreserveRawSms] = useState(
    savedWorkspace?.preserveRawSms ?? true,
  );
  const [autoReconciliation, setAutoReconciliation] = useState(
    savedWorkspace?.autoReconciliation ?? true,
  );
  const [verboseLogging, setVerboseLogging] = useState(
    savedWorkspace?.verboseLogging ?? false,
  );
  const smsCaptureQueue = useTransactionStore((state) => state.smsCaptureQueue);
  const smsCaptureQueueSummary = useTransactionStore(
    (state) => state.smsCaptureQueueSummary,
  );
  const smsCaptureDiagnostics = useTransactionStore(
    (state) => state.smsCaptureDiagnostics,
  );
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const customAccounts = useTransactionStore((state) => state.customAccounts);
  const processNextSmsCaptureQueueItem = useTransactionStore(
    (state) => state.processNextSmsCaptureQueueItem,
  );
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null;
  const parserWorkspaceModel = useMemo(
    () => migrateResolvedTemplatesToWorkspace(templates),
    [templates],
  );
  const latestCapturedSms = useMemo(() => {
    if (smsCaptureQueue.length === 0) {
      return null;
    }

    return [...smsCaptureQueue].sort(
      (left, right) =>
        new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
    )[0];
  }, [smsCaptureQueue]);
  const [sampleSource, setSampleSource] = useState<SampleSource>(() =>
    latestCapturedSms ? "capture" : "manual",
  );
  const [manualSenderLabel, setManualSenderLabel] = useState(
    savedWorkspace?.senderLabel ??
      selectedTemplate?.senderAliases[0] ??
      selectedTemplate?.institutionKey ??
      "CBE",
  );
  const [manualSample, setManualSample] = useState(() =>
    getFallbackSampleForTemplate(selectedTemplate),
  );
  const parserFamilies = useMemo(() => listBuiltInParserTemplateFamilies(), []);
  const managedAccounts = useMemo<ManagedParserAccount[]>(
    () => [
      ...accountSummaries.map((account) => ({ ...account })),
      ...customAccounts.map((account) => ({
        ...account,
        note: account.note,
      })),
    ],
    [accountSummaries, customAccounts],
  );
  const isFirstRunWorkspace =
    managedAccounts.length === 0 &&
    approvalQueue.length === 0 &&
    unmatchedMessages.length === 0 &&
    smsCaptureQueueSummary.pendingCount === 0 &&
    !latestCapturedSms;
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    () =>
      selectedTemplate?.linkedAccountId ??
      savedWorkspace?.templateWorkspace.accountBindings[0]?.accountId ??
      "",
  );
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string>("");
  const [profileDraft, setProfileDraft] = useState<TemplateProfileDraft>(() =>
    buildProfileDraft(selectedTemplate ?? defaultTemplates[0]!),
  );
  const [parserStatus, setParserStatus] = useState<{
    tone: "neutral" | "success" | "warning";
    message: string;
  } | null>(null);
  const builtInTemplateCount = templates.filter(
    (template) => template.templateKind === "builtin",
  ).length;
  const customTemplateCount = templates.filter(
    (template) => template.templateKind === "custom",
  ).length;
  const builtInOverrideCount = parserWorkspaceModel.builtInOverrides.length;
  const builtInOverrideIdSet = useMemo(
    () =>
      new Set(parserWorkspaceModel.builtInOverrides.map((override) => override.templateId)),
    [parserWorkspaceModel],
  );
  const selectedAccount =
    managedAccounts.find((account) => account.accountId === selectedAccountId) ??
    managedAccounts[0] ??
    null;
  const selectedAccountBinding =
    (selectedAccount
      ? parserWorkspaceModel.accountBindings.find(
          (binding) => binding.accountId === selectedAccount.accountId,
        )
      : null) ?? null;
  const selectedAccountFamily = useMemo(() => {
    if (selectedFamilyKey) {
      return findBuiltInParserTemplateFamily(selectedFamilyKey) ?? null;
    }

    if (selectedAccountBinding) {
      return findBuiltInParserTemplateFamily(selectedAccountBinding.institutionKey) ?? null;
    }

    if (selectedAccount) {
      return suggestBuiltInParserTemplateFamily(selectedAccount.institutionName);
    }

    return null;
  }, [selectedAccount, selectedAccountBinding, selectedFamilyKey]);
  const accountTemplates = useMemo(
    () =>
      selectedAccount
        ? templates.filter((template) => template.linkedAccountId === selectedAccount.accountId)
        : [],
    [selectedAccount, templates],
  );
  const familyPreviewTemplates = useMemo(() => {
    if (!selectedAccountFamily) {
      return [] as ParserTemplateDefinition[];
    }

    if (accountTemplates.length > 0) {
      return accountTemplates;
    }

    return defaultTemplates.filter(
      (template) =>
        template.templateKind === "builtin" &&
        template.institutionKey === selectedAccountFamily.institutionKey,
    );
  }, [accountTemplates, defaultTemplates, selectedAccountFamily]);
  const selectedAccountTemplate =
    accountTemplates.find((template) => template.id === selectedTemplateId) ??
    accountTemplates[0] ??
    selectedTemplate;
  const selectedVariantTemplate =
    familyPreviewTemplates.find((template) => template.id === selectedTemplateId) ??
    familyPreviewTemplates[0] ??
    selectedAccountTemplate ??
    selectedTemplate;

  useEffect(() => {
    if (!selectedAccountId) {
      const nextAccountId =
        selectedTemplate?.linkedAccountId ??
        parserWorkspaceModel.accountBindings[0]?.accountId ??
        managedAccounts[0]?.accountId ??
        "";
      if (nextAccountId) {
        setSelectedAccountId(nextAccountId);
      }
    }
  }, [
    managedAccounts,
    parserWorkspaceModel.accountBindings,
    selectedAccountId,
    selectedTemplate?.linkedAccountId,
  ]);

  useEffect(() => {
    if (selectedAccountBinding) {
      setSelectedFamilyKey(selectedAccountBinding.institutionKey);
      return;
    }

    if (selectedAccount) {
      const suggestedFamily = suggestBuiltInParserTemplateFamily(
        selectedAccount.institutionName,
      );
      setSelectedFamilyKey(suggestedFamily?.institutionKey ?? "");
      return;
    }

    setSelectedFamilyKey("");
  }, [selectedAccount, selectedAccountBinding]);

  useEffect(() => {
    if (familyPreviewTemplates.length === 0) {
      return;
    }

    if (!familyPreviewTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(familyPreviewTemplates[0]?.id ?? "");
    }
  }, [familyPreviewTemplates, selectedTemplateId]);

  useEffect(() => {
    setProfileDraft(
      buildBindingDraft(
        selectedAccountBinding,
        selectedAccount,
        selectedAccountFamily,
        selectedAccountTemplate,
      ),
    );
    if (sampleSource === "manual") {
      setManualSenderLabel((current) =>
        current.trim().length > 0
          ? current
          : selectedAccountTemplate?.senderAliases[0] ??
            selectedAccountFamily?.defaultSenderAliases[0] ??
            selectedAccountTemplate?.institutionKey ??
            "CBE",
      );
      setManualSample((current) =>
        current.trim().length > 0
          ? current
          : getFallbackSampleForTemplate(selectedAccountTemplate ?? selectedTemplate ?? null),
      );
    }
  }, [
    sampleSource,
    selectedAccount,
    selectedAccountBinding,
    selectedAccountFamily,
    selectedAccountTemplate,
    selectedTemplate,
  ]);

  useEffect(() => {
    if (!selectedTemplate && !selectedVariantTemplate) {
      return;
    }

    persistParserWorkspacePreferences({
      version: 3,
      templateWorkspace: parserWorkspaceModel,
      selectedTemplateId: selectedVariantTemplate?.id ?? selectedTemplate?.id ?? "",
      senderLabel: manualSenderLabel,
      strictSchemaParsing,
      preserveRawSms,
      autoReconciliation,
      verboseLogging,
    });
  }, [
    autoReconciliation,
    manualSenderLabel,
    parserWorkspaceModel,
    preserveRawSms,
    selectedVariantTemplate,
    selectedTemplate,
    strictSchemaParsing,
    verboseLogging,
  ]);

  const runtime = useMemo(
    () =>
      buildParserRuntimeOptionsFromWorkspace(parserWorkspaceModel, {
        preferredTemplateId: selectedAccountTemplate?.id ?? selectedTemplate?.id,
        includeDraftTemplates: true,
      }),
    [parserWorkspaceModel, selectedAccountTemplate?.id, selectedTemplate?.id],
  );
  useSmsCaptureRuntime({
    autoDrainQueue: true,
    runtime,
  });
  const activeSenderLabel =
    sampleSource === "capture"
      ? latestCapturedSms?.senderLabel ?? manualSenderLabel
      : manualSenderLabel;
  const activeSample =
    sampleSource === "capture" ? latestCapturedSms?.smsBody ?? "" : manualSample;
  const { previewResult, parseAndQueue } = useParser(activeSample, activeSenderLabel, {
    runtime,
    verboseLogging,
  });
  const inspection = selectedVariantTemplate
    ? inspectParserTemplate(selectedVariantTemplate)
    : selectedTemplate
      ? inspectParserTemplate(selectedTemplate)
      : null;

  function updateSelectedTemplate(
    updater: (template: ParserTemplateDefinition) => ParserTemplateDefinition,
  ) {
    if (!selectedTemplate || !selectedTemplate.engineEditable) {
      setParserStatus({
        tone: "warning",
        message:
          "Built-in templates stay visible as defaults. Create a custom template before editing parser code or extraction keys.",
      });
      return;
    }

    setTemplates((current) =>
      current.map((template) =>
        template.id === selectedTemplate.id
          ? {
              ...updater(template),
              updated: "Updated locally",
            }
          : template,
      ),
    );
  }

  function handleProfileApply() {
    const senderAliases = parseTextList(profileDraft.senderAliases);
    const accountIdentifiers = parseTextList(profileDraft.accountIdentifiers);
    const identityTextFragments = parseTextList(profileDraft.identityTextFragments);

    if (selectedTemplate?.templateKind === "custom") {
      setTemplates((current) =>
        current.map((template) => {
          if (template.id !== selectedTemplate.id) {
            return template;
          }

          const nextAliases =
            senderAliases.length > 0 ? senderAliases : template.senderAliases;
          return {
            ...template,
            name: profileDraft.name.trim() || template.name,
            senderAliases: nextAliases,
            accountIdentifiers,
            identityTextFragments,
            userProfile: {
              senderAliases: nextAliases,
              accountIdentifiers,
              identityTextFragments,
            },
            updated: "Updated locally",
          };
        }),
      );
      setParserStatus({
        tone: "success",
        message:
          "Custom template variables updated. Sender aliases and identity fragments now participate in live matching.",
      });
      return;
    }

    if (!selectedAccount || !selectedAccountFamily) {
      setParserStatus({
        tone: "warning",
        message:
          "Choose an account or add one first so the parser can store sender and account-specific values against that account.",
      });
      return;
    }

    const nextWorkspace = upsertParserAccountBinding(parserWorkspaceModel, {
      accountId: selectedAccount.accountId,
      accountLabel: selectedAccount.institutionName,
      accountChannel: selectedAccount.channel,
      financialInstitution: selectedAccountFamily.financialInstitution,
      institutionKey: selectedAccountFamily.institutionKey,
      status: "active",
      userProfile: {
        senderAliases:
          senderAliases.length > 0
            ? senderAliases
            : selectedAccountFamily.defaultSenderAliases,
        accountIdentifiers:
          accountIdentifiers.length > 0
            ? accountIdentifiers
            : buildAccountIdentifierFallback(selectedAccount),
        identityTextFragments,
      },
    });
    const resolvedTemplates = resolveParserTemplateWorkspace(nextWorkspace);
    const nextSelectedTemplateId =
      resolvedTemplates.find(
        (template) => template.linkedAccountId === selectedAccount.accountId,
      )?.id ??
      resolvedTemplates[0]?.id ??
      "";

    setTemplates(resolvedTemplates);
    setSelectedTemplateId(nextSelectedTemplateId);
    setParserStatus({
      tone: "success",
      message:
        "Built-in parser family saved for this account. The core parser logic stayed immutable while your sender and account identifiers were attached to the account binding.",
    });
  }

  function handleCreateCustomDraft() {
    if (!selectedAccountTemplate && !selectedTemplate) {
      return;
    }

    const templateSeed = selectedAccountTemplate ?? selectedTemplate;
    if (!templateSeed) {
      return;
    }

    const nextTemplate = {
      ...buildCustomTemplateSeed(templateSeed),
      linkedAccountId: selectedAccount?.accountId,
      linkedAccountLabel: selectedAccount?.institutionName,
    };
    setTemplates((current) => [...current, nextTemplate]);
    setSelectedTemplateId(nextTemplate.id);
    setActiveTab("templates");
    setParserStatus({
      tone: "success",
      message:
        "Custom template draft created from the selected institution family. Update the regex and extraction bindings below.",
    });
  }

  function handleResetWorkspace() {
    const defaults = resolveParserTemplateWorkspace(
      createDefaultParserTemplateWorkspace(),
    );
    setTemplates(defaults);
    setSelectedTemplateId(defaults[0]?.id ?? "");
    setSelectedAccountId("");
    setManualSenderLabel(defaults[0]?.senderAliases[0] ?? "CBE");
    setManualSample(getFallbackSampleForTemplate(defaults[0] ?? null));
    setStrictSchemaParsing(true);
    setPreserveRawSms(true);
    setAutoReconciliation(true);
    setVerboseLogging(false);
    clearParserWorkspacePreferences();
    setParserStatus({
      tone: "neutral",
      message: "Parser workspace reset to the built-in template set.",
    });
  }

  function handleDetachAccountSetup() {
    if (!selectedAccount) {
      return;
    }

    const nextWorkspace = removeParserAccountBinding(
      parserWorkspaceModel,
      selectedAccount.accountId,
    );
    const resolvedTemplates = resolveParserTemplateWorkspace(nextWorkspace);
    setTemplates(resolvedTemplates);
    setSelectedTemplateId(resolvedTemplates[0]?.id ?? "");
    setParserStatus({
      tone: "neutral",
      message:
        "Account-specific parser values were removed. The built-in family stays available as the baseline.",
    });
  }

  function handleQueuePreview() {
    if (!activeSample.trim() || !activeSenderLabel.trim()) {
      setParserStatus({
        tone: "warning",
        message: "Add a sample SMS body and sender label before routing preview output.",
      });
      return;
    }

    const result = parseAndQueue({
      address: activeSenderLabel,
      body: activeSample,
      timestamp_ms: Date.now(),
    });

    if (result.status === "queued") {
      setParserStatus({
        tone: "success",
        message: "Preview routed into Inbox as a reviewable draft.",
      });
      onOpenTab("inbox");
      return;
    }

    setParserStatus({
      tone: "warning",
      message: "Preview stayed unmatched and was captured for parser review.",
    });
    setActiveTab("diagnostics");
  }

  function handleRouteCaptureQueue() {
    const result = processNextSmsCaptureQueueItem({
      processedAt: new Date().toISOString(),
      runtime,
    });

    if (!result) {
      setParserStatus({
        tone: "warning",
        message: "There is no queued capture waiting for parser handoff.",
      });
      return;
    }

    if (result.status === "queued") {
      setParserStatus({
        tone: "success",
        message: "Captured SMS routed into Inbox using the live parser pipeline.",
      });
      onOpenTab("inbox");
      return;
    }

    if (result.status === "unmatched") {
      setParserStatus({
        tone: "warning",
        message: "Captured SMS reached the parser but still stayed unmatched.",
      });
      setActiveTab("diagnostics");
      return;
    }

    setParserStatus({
      tone: "warning",
      message: result.failureReason,
    });
  }

  return (
    <section className="space-y-5">
      <MotionPanel className="rounded-[28px] border border-outline-variant/35 bg-surface px-5 py-5 shadow-[0_18px_44px_rgba(46,50,48,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                icon="code"
                tone={isFirstRunWorkspace ? "warning" : "success"}
              >
                {isFirstRunWorkspace ? "SMS matching comes later" : "Live parser workspace"}
              </StatusChip>
              <StatusChip icon="extension" tone="neutral">
                Built-in templates stay available
              </StatusChip>
              <StatusChip
                icon="sms"
                tone={latestCapturedSms ? "success" : isFirstRunWorkspace ? "neutral" : "warning"}
              >
                {latestCapturedSms
                  ? "Latest capture ready"
                  : isFirstRunWorkspace
                    ? "Waiting for your first account"
                    : "Waiting for captured SMS"}
              </StatusChip>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/75">
                Parser controls
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-on-surface">
                Parsing workspace
              </h1>
            </div>
            <p className="max-w-3xl text-sm text-on-surface-variant">
              {isFirstRunWorkspace
                ? "Create an account first. Preview and system checks will unlock after you have real SMS activity to review."
                : "Tune templates, save account bindings, preview matches, and check diagnostics."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricPill label="Templates" value={templates.length} />
            <MetricPill label="Overrides" value={builtInOverrideCount} />
            <MetricPill label="Custom" value={customTemplateCount} />
            <MetricPill label="Queued SMS" value={smsCaptureQueueSummary.pendingCount} />
            <MetricPill label="Unmatched" value={unmatchedMessages.length} />
          </div>
        </div>
      </MotionPanel>

      {parserStatus ? (
        <MotionPanel
          className={joinClasses(
            "rounded-2xl border px-4 py-3",
            parserStatus.tone === "success"
              ? "border-primary/20 bg-primary-container/40 text-primary"
              : parserStatus.tone === "warning"
                ? "border-tertiary/20 bg-tertiary-container/35 text-on-tertiary-container"
                : "border-outline-variant/30 bg-surface-container text-on-surface",
          )}
          variant="toast"
        >
          <div className="flex items-start gap-2">
            <MaterialSymbol
              className="mt-0.5 text-base"
              name={
                parserStatus.tone === "success"
                  ? "check_circle"
                  : parserStatus.tone === "warning"
                    ? "warning"
                    : "info"
              }
            />
            <p className="text-sm font-medium">{parserStatus.message}</p>
          </div>
        </MotionPanel>
      ) : null}

      <MotionPanel className="rounded-[28px] border border-outline-variant/25 bg-background p-2 shadow-[0_12px_36px_rgba(46,50,48,0.08)]">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { id: "templates", label: "Templates", icon: "extension" },
            {
              id: "sandbox",
              label: isFirstRunWorkspace ? "Preview coming soon" : "Preview",
              icon: "labs",
              disabled: isFirstRunWorkspace,
            },
            {
              id: "diagnostics",
              label: isFirstRunWorkspace ? "Checks coming soon" : "Diagnostics",
              icon: "monitoring",
              disabled: isFirstRunWorkspace,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              className={joinClasses(
                pressableClass,
                "flex items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold",
                tab.disabled && "cursor-not-allowed opacity-55",
                activeTab === tab.id
                  ? "bg-primary text-on-primary shadow-[0_10px_24px_rgba(43,107,67,0.18)]"
                  : "bg-surface text-on-surface-variant",
              )}
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id as ParserTabId)}
              type="button"
            >
              <MaterialSymbol className="text-base" name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </MotionPanel>

      {activeTab === "templates" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.3fr]">
          <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                  Template families
                </p>
                <h2 className="text-lg font-semibold text-on-surface">Templates</h2>
              </div>
              <button
                className={joinClasses(
                  pressableClass,
                  "rounded-full border border-outline-variant/35 px-3 py-1.5 text-xs font-semibold text-on-surface-variant",
                )}
                onClick={handleResetWorkspace}
                type="button"
              >
                Reset workspace
              </button>
            </div>

            <div className="rounded-[24px] border border-outline-variant/20 bg-background p-4">
              <p className="text-sm font-semibold text-on-surface">Built-in parser family</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Pick an account, then pick its built-in family.
              </p>

              <div className="mt-4 space-y-2">
                {managedAccounts.length > 0 ? (
                  managedAccounts.map((account) => {
                    const isSelected = selectedAccount?.accountId === account.accountId;
                    const binding = parserWorkspaceModel.accountBindings.find(
                      (entry) => entry.accountId === account.accountId,
                    );
                    const suggestedFamily =
                      findBuiltInParserTemplateFamily(binding?.institutionKey ?? "") ??
                      suggestBuiltInParserTemplateFamily(account.institutionName);

                    return (
                      <button
                        key={account.accountId}
                        className={joinClasses(
                          pressableClass,
                          "w-full rounded-[20px] border px-4 py-3 text-left",
                          isSelected
                            ? "border-primary/25 bg-primary-container/25"
                            : "border-outline-variant/25 bg-surface",
                        )}
                        onClick={() => setSelectedAccountId(account.accountId)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-on-surface">
                                {account.institutionName}
                              </p>
                              <StatusChip tone={binding ? "success" : "warning"}>
                                {binding ? "Configured" : "Needs setup"}
                              </StatusChip>
                            </div>
                            <p className="text-sm text-on-surface-variant">
                              {account.maskedAccountNumber}
                              {suggestedFamily
                                ? ` • ${suggestedFamily.institutionLabel} family`
                                : " • No built-in family suggested yet"}
                            </p>
                          </div>
                          <MaterialSymbol
                            className={joinClasses(
                              "text-lg",
                              isSelected ? "text-primary" : "text-on-surface-variant/70",
                            )}
                            name={isSelected ? "radio_button_checked" : "radio_button_unchecked"}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-outline-variant/25 bg-surface px-4 py-4 text-sm text-on-surface-variant">
                    Create an account first. SMS matching will be ready once
                    you have an account to connect.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {parserFamilies.map((family) => (
                  <button
                    className={joinClasses(
                      pressableClass,
                      "rounded-full px-3 py-2 text-xs font-semibold",
                      selectedAccountFamily?.institutionKey === family.institutionKey
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant",
                    )}
                    key={family.institutionKey}
                    onClick={() => setSelectedFamilyKey(family.institutionKey)}
                    type="button"
                  >
                    {family.institutionLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {(familyPreviewTemplates.length > 0 ? familyPreviewTemplates : templates).map((template) => {
                const isSelected = selectedTemplate?.id === template.id;
                return (
                  <button
                    key={template.id}
                    className={joinClasses(
                      pressableClass,
                      "w-full rounded-[22px] border px-4 py-3 text-left",
                      isSelected
                        ? "border-primary/25 bg-primary-container/25"
                        : "border-outline-variant/25 bg-background",
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-on-surface">{template.name}</p>
                          <StatusChip
                            tone={template.templateKind === "custom" ? "warning" : "neutral"}
                          >
                            {template.templateKind === "custom" ? "Custom" : "Built-in"}
                          </StatusChip>
                          <StatusChip tone="neutral">{formatDirectionLabel(template.direction)}</StatusChip>
                          {template.templateKind === "builtin" &&
                          builtInOverrideIdSet.has(
                            template.builtInTemplateId ?? template.id,
                          ) ? (
                            <StatusChip icon="tune" tone="success">
                              Override
                            </StatusChip>
                          ) : null}
                        </div>
                        <p className="text-sm text-on-surface-variant">
                          {template.institutionLabel} • {template.note}
                        </p>
                      </div>
                      <MaterialSymbol
                        className={joinClasses(
                          "text-lg",
                          isSelected ? "text-primary" : "text-on-surface-variant/70",
                        )}
                        name={isSelected ? "radio_button_checked" : "radio_button_unchecked"}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </MotionPanel>

          <div className="space-y-4">
            <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                    Account bindings
                  </p>
                  <h2 className="text-lg font-semibold text-on-surface">
                    {selectedAccount?.institutionName ?? "Bindings"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip tone={selectedAccountBinding ? "success" : "warning"}>
                    {selectedAccountBinding ? "Saved" : "Not saved"}
                  </StatusChip>
                  <StatusChip icon="settings_account_box" tone="neutral">
                    Account-specific values
                  </StatusChip>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldShell label="Account">
                  <input
                    className={joinClasses(
                      "w-full rounded-2xl border px-4 py-3 text-sm outline-none",
                      "border-outline-variant/15 bg-surface-container-low text-on-surface-variant",
                    )}
                    readOnly
                    type="text"
                    value={selectedAccount?.institutionName ?? "No account selected"}
                  />
                </FieldShell>
                <FieldShell label="Sender label aliases">
                  <input
                    className="w-full rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        senderAliases: event.target.value,
                      }))
                    }
                    placeholder={
                      selectedAccountFamily?.defaultSenderAliases.join(", ") ?? "CBE, CBE ALERT"
                    }
                    type="text"
                    value={profileDraft.senderAliases}
                  />
                </FieldShell>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldShell label="Account identifiers">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        accountIdentifiers: event.target.value,
                      }))
                    }
                    placeholder={
                      buildAccountIdentifierFallback(selectedAccount).join(", ") || "4920, 0172"
                    }
                    value={profileDraft.accountIdentifiers}
                  />
                </FieldShell>
                <FieldShell label="Identity text fragments">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        identityTextFragments: event.target.value,
                      }))
                    }
                    placeholder="salary, grocery, personal wallet"
                    value={profileDraft.identityTextFragments}
                  />
                </FieldShell>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
                  )}
                  onClick={handleProfileApply}
                  type="button"
                >
                  Save account parser setup
                </button>
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full border border-outline-variant/30 bg-background px-4 py-2 text-sm font-semibold text-on-surface",
                  )}
                  onClick={handleCreateCustomDraft}
                  type="button"
                >
                  Build custom template
                </button>
                {selectedAccountBinding ? (
                  <button
                    className={joinClasses(
                      pressableClass,
                      "rounded-full border border-outline-variant/30 bg-background px-4 py-2 text-sm font-semibold text-on-surface-variant",
                    )}
                    onClick={handleDetachAccountSetup}
                    type="button"
                  >
                    Remove account setup
                  </button>
                ) : null}
              </div>
            </MotionPanel>

            <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                    Selected template
                  </p>
                  <h2 className="text-lg font-semibold text-on-surface">Template fields</h2>
                </div>
                <StatusChip tone={selectedVariantTemplate?.engineEditable ? "success" : "neutral"}>
                  {selectedVariantTemplate?.engineEditable
                    ? "Editable custom"
                    : "Read-only built-in"}
                </StatusChip>
              </div>

              <div className="flex flex-wrap gap-2">
                {familyPreviewTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={joinClasses(
                      pressableClass,
                      "rounded-full px-3 py-2 text-xs font-semibold",
                      selectedVariantTemplate?.id === template.id
                        ? "bg-primary text-on-primary"
                        : "bg-background text-on-surface-variant",
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    {template.name} • {formatDirectionLabel(template.direction)}
                  </button>
                ))}
              </div>

              <FieldShell label="Parser regex">
                <textarea
                  className="min-h-32 w-full rounded-[22px] border border-outline-variant/25 bg-[#10150f] px-4 py-3 font-mono text-[13px] text-[#dff0df] outline-none"
                  onChange={(event) =>
                    updateSelectedTemplate((template) => ({
                      ...template,
                      regex: event.target.value,
                    }))
                  }
                  readOnly={!selectedVariantTemplate?.engineEditable}
                  spellCheck={false}
                  value={selectedVariantTemplate?.regex ?? ""}
                />
              </FieldShell>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {inspection?.bindings.map((binding) => (
                  <FieldShell key={binding.field} label={bindingLabels[binding.field]}>
                    <input
                      className={joinClasses(
                        "w-full rounded-2xl border px-4 py-3 text-sm outline-none",
                        selectedVariantTemplate?.engineEditable
                          ? "border-outline-variant/25 bg-background text-on-surface"
                          : "border-outline-variant/15 bg-surface-container-low text-on-surface-variant",
                      )}
                      onChange={(event) =>
                        updateSelectedTemplate((template) =>
                          updateTemplateField(template, binding.field, event.target.value),
                        )
                      }
                      readOnly={!selectedVariantTemplate?.engineEditable}
                      spellCheck={false}
                      type="text"
                      value={binding.captureKey ?? ""}
                    />
                  </FieldShell>
                ))}
              </div>
            </MotionPanel>
          </div>
        </div>
      ) : null}

      {activeTab === "sandbox" ? (
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                  Live preview
                </p>
                <h2 className="text-lg font-semibold text-on-surface">Preview</h2>
              </div>
              <div className="flex rounded-full bg-background p-1">
                {[
                  {
                    id: "capture",
                    label: "Latest captured SMS",
                    disabled: !latestCapturedSms,
                  },
                  {
                    id: "manual",
                    label: "Manual sample",
                    disabled: false,
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    className={joinClasses(
                      pressableClass,
                      "rounded-full px-3 py-2 text-xs font-semibold",
                      sampleSource === mode.id
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant",
                      mode.disabled && "cursor-not-allowed opacity-45",
                    )}
                    disabled={mode.disabled}
                    onClick={() => setSampleSource(mode.id as SampleSource)}
                    type="button"
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {sampleSource === "capture" ? (
              <div className="space-y-3 rounded-[24px] border border-outline-variant/25 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="success">Latest captured SMS</StatusChip>
                  <StatusChip tone="neutral">
                    {latestCapturedSms?.senderLabel ?? "No sender"}
                  </StatusChip>
                  <StatusChip tone="neutral">
                    {formatDateTime(latestCapturedSms?.capturedAt)}
                  </StatusChip>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-on-surface">
                  {latestCapturedSms?.smsBody ?? "No captured SMS is available yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <FieldShell label="Manual sender label">
                  <input
                    className="w-full rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
                    onChange={(event) => setManualSenderLabel(event.target.value)}
                    type="text"
                    value={manualSenderLabel}
                  />
                </FieldShell>
                <FieldShell label="Sample SMS body">
                  <textarea
                    className="min-h-40 w-full rounded-[24px] border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
                    onChange={(event) => setManualSample(event.target.value)}
                    placeholder={getFallbackSampleForTemplate(selectedTemplate)}
                    value={manualSample}
                  />
                </FieldShell>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                className={joinClasses(
                  pressableClass,
                  "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
                )}
                onClick={handleQueuePreview}
                type="button"
              >
                Queue to Inbox
              </button>
              <button
                className={joinClasses(
                  pressableClass,
                  "rounded-full border border-outline-variant/30 bg-background px-4 py-2 text-sm font-semibold text-on-surface",
                )}
                onClick={handleRouteCaptureQueue}
                type="button"
              >
                Route live capture queue
              </button>
            </div>
          </MotionPanel>

          <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                  Preview result
                </p>
                <h2 className="text-lg font-semibold text-on-surface">
                  {previewResult.status === "matched" ? "Matched template" : "Failure state"}
                </h2>
              </div>
              <StatusChip tone={previewResult.status === "matched" ? "success" : "warning"}>
                {previewResult.status === "matched" ? "Matched" : "Unmatched"}
              </StatusChip>
            </div>

            {previewResult.status === "matched" ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-primary/15 bg-primary-container/20 p-4">
                  <p className="text-sm font-semibold text-primary">
                    {templates.find(
                      (template) => template.id === previewResult.draft.parserTemplateId,
                    )?.name ?? previewResult.draft.parserTemplateId}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {previewResult.draft.senderLabel} / {previewResult.draft.title}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ResultCard label="Amount" value={`ETB ${(previewResult.draft.amountMinor / 100).toFixed(2)}`} />
                  <ResultCard label="Direction" value={previewResult.draft.transactionDirection} />
                  <ResultCard label="Balance" value={`ETB ${(previewResult.draft.runningBalanceMinor / 100).toFixed(2)}`} />
                  <ResultCard label="Category" value={previewResult.draft.category} />
                  <ResultCard label="Account" value={previewResult.draft.accountReference ?? "None"} />
                  <ResultCard label="Reference" value={previewResult.draft.reference ?? "None"} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-[24px] border border-tertiary/18 bg-tertiary-container/25 p-4">
                <p className="text-sm font-semibold text-on-tertiary-container">
                  {formatFailureReason(previewResult)}
                </p>
                <p className="text-sm text-on-surface-variant">
                  Check sender aliases, identifiers, fragments, and regex.
                </p>
              </div>
            )}
          </MotionPanel>
        </div>
      ) : null}

      {activeTab === "diagnostics" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                Live wiring
              </p>
              <h2 className="text-lg font-semibold text-on-surface">Diagnostics</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Built-in templates" value={builtInTemplateCount} />
              <MetricCard label="Built-in overrides" value={builtInOverrideCount} />
              <MetricCard label="Custom templates" value={customTemplateCount} />
              <MetricCard label="Inbox drafts" value={approvalQueue.length} />
              <MetricCard label="Unmatched review" value={unmatchedMessages.length} />
              <MetricCard label="Queued captures" value={smsCaptureQueueSummary.pendingCount} />
              <MetricCard label="Last parser outcome" value={formatParserOutcomeLabel(smsCaptureDiagnostics.lastParserOutcome)} />
            </div>
          </MotionPanel>

          <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Capture support" value={smsCaptureDiagnostics.captureSupported ? "Available" : "Not live yet"} />
              <InfoRow label="Native capture" value={smsCaptureDiagnostics.nativeCaptureAvailable ? "Connected" : "Bridge unavailable"} />
              <InfoRow label="Last captured sender" value={smsCaptureDiagnostics.lastCapturedSenderLabel ?? "None"} />
              <InfoRow label="Last capture time" value={formatDateTime(smsCaptureDiagnostics.lastCapturedAt)} />
              <InfoRow label="Last parser handoff" value={formatDateTime(smsCaptureDiagnostics.lastParserHandoffAt)} />
              <InfoRow label="Filtered out" value={String(smsCaptureDiagnostics.filteredOutCount)} />
              <InfoRow label="Duplicate suppressed" value={String(smsCaptureDiagnostics.duplicateSuppressedCount)} />
              <InfoRow label="Workspace persistence" value="Live in shared authority state" />
            </div>
            <div className="rounded-[24px] border border-outline-variant/20 bg-background p-4">
              <p className="text-sm font-semibold text-on-surface">Persistence</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Built-in engines stay read-only. Bindings, custom templates, and
                statuses save in shared authority state.
              </p>
            </div>
          </MotionPanel>
        </div>
      ) : null}

      <MotionPanel className="grid gap-3 rounded-[28px] border border-outline-variant/25 bg-surface-container-low px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <ToggleTile
          checked={strictSchemaParsing}
          description="Treat missing required groups as hard parser misses."
          label="Strict schema"
          onClick={() => setStrictSchemaParsing((current) => !current)}
        />
        <ToggleTile
          checked={preserveRawSms}
          description="Keep raw SMS content available for review surfaces."
          label="Preserve raw SMS"
          onClick={() => setPreserveRawSms((current) => !current)}
        />
        <ToggleTile
          checked={autoReconciliation}
          description="Keep balance reconciliation signals active after parser matches."
          label="Auto reconciliation"
          onClick={() => setAutoReconciliation((current) => !current)}
        />
        <ToggleTile
          checked={verboseLogging}
          description="Write richer parser debug output when testing edge cases."
          label="Verbose logging"
          onClick={() => setVerboseLogging((current) => !current)}
        />
      </MotionPanel>
    </section>
  );
}

function FieldShell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleTile({
  checked,
  description,
  label,
  onClick,
}: {
  checked: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={joinClasses(
        pressableClass,
        "rounded-[22px] border px-4 py-3 text-left",
        checked ? "border-primary/25 bg-primary-container/25" : "border-outline-variant/25 bg-surface",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-on-surface">{label}</p>
        <StatusChip tone={checked ? "success" : "neutral"}>{checked ? "On" : "Off"}</StatusChip>
      </div>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </button>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-outline-variant/25 bg-background px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[24px] border border-outline-variant/20 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-outline-variant/20 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-on-surface">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-outline-variant/20 bg-background px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-on-surface">{value}</p>
    </div>
  );
}
