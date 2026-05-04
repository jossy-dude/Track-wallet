import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const accountChannels = ["bank", "mobile_money", "cash"] as const;
export const transactionDirections = ["credit", "debit", "transfer"] as const;
export const transactionEventKinds = [
  "approved_sms",
  "manual_entry",
  "opening_balance",
  "balance_correction",
] as const;
export const draftStatuses = [
  "pending_review",
  "approved",
  "rejected",
] as const;
export const rawMessageSourceKinds = ["sms", "manual", "import"] as const;
export const rawMessageProcessingStates = [
  "pending",
  "matched",
  "unmatched",
  "ignored",
] as const;
export const reconciliationStatuses = [
  "pending",
  "resolved",
  "ignored",
] as const;
export const reconciliationResolutionKinds = [
  "interest",
  "bank_fee",
  "vat_or_tax",
  "balance_correction",
  "missing_history",
  "unclassified",
] as const;
export const syncPlatforms = ["desktop", "mobile", "tablet"] as const;
export const syncActivityTypes = [
  "discovery",
  "pairing",
  "sync",
  "trust",
] as const;
export const syncActivityStatuses = [
  "success",
  "pending",
  "warning",
] as const;
export const trustedDeviceStates = ["trusted", "revoked"] as const;
export const budgetCadences = ["weekly", "monthly", "quarterly", "yearly"] as const;

export const rawMessages = sqliteTable(
  "raw_messages",
  {
    rawMessageId: text("raw_message_id").primaryKey(),
    sourceHash: text("source_hash").notNull(),
    senderLabel: text("sender_label").notNull(),
    messageBody: text("message_body").notNull(),
    receivedAt: text("received_at").notNull(),
    importedAt: text("imported_at").notNull(),
    sourceKind: text("source_kind", { enum: rawMessageSourceKinds })
      .notNull()
      .default("sms"),
    parserTemplateId: text("parser_template_id"),
    institutionCode: text("institution_code"),
    processingState: text("processing_state", {
      enum: rawMessageProcessingStates,
    })
      .notNull()
      .default("pending"),
    processingNote: text("processing_note"),
  },
  (table) => ({
    sourceHashIdx: uniqueIndex("raw_messages_source_hash_idx").on(
      table.sourceHash,
    ),
  }),
);

export const accounts = sqliteTable(
  "accounts",
  {
    accountId: text("account_id").primaryKey(),
    institutionCode: text("institution_code"),
    accountChannel: text("account_channel", { enum: accountChannels }).notNull(),
    currencyCode: text("currency_code").notNull().default("ETB"),
    accountReference: text("account_reference"),
    displayName: text("display_name").notNull(),
    lastReportedBalanceMinor: integer("last_reported_balance_minor"),
    currentBalanceMinor: integer("current_balance_minor"),
    lastBalanceReportedAt: text("last_balance_reported_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    accountReferenceIdx: uniqueIndex("accounts_reference_channel_idx").on(
      table.institutionCode,
      table.accountChannel,
      table.accountReference,
    ),
  }),
);

export const inboxDrafts = sqliteTable(
  "inbox_drafts",
  {
    draftId: text("draft_id").primaryKey(),
    rawMessageId: text("raw_message_id").references(() => rawMessages.rawMessageId),
    accountId: text("account_id").references(() => accounts.accountId),
    senderLabel: text("sender_label").notNull(),
    rawBody: text("raw_body").notNull(),
    institutionCode: text("institution_code").notNull(),
    accountChannel: text("account_channel", { enum: accountChannels }).notNull(),
    transactionDirection: text("transaction_direction", {
      enum: transactionDirections,
    }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    feeMinor: integer("fee_minor").notNull().default(0),
    reportedBalanceMinor: integer("reported_balance_minor"),
    currencyCode: text("currency_code").notNull().default("ETB"),
    title: text("title").notNull(),
    merchantName: text("merchant_name"),
    category: text("category"),
    parserTemplateId: text("parser_template_id"),
    confidenceBasisPoints: integer("confidence_basis_points"),
    occurredAt: text("occurred_at").notNull(),
    accountReference: text("account_reference"),
    reference: text("reference"),
    note: text("note"),
    status: text("status", { enum: draftStatuses })
      .notNull()
      .default("pending_review"),
    queuedAt: text("queued_at").notNull(),
    reviewedAt: text("reviewed_at"),
  },
  (table) => ({
    rawMessageIdx: uniqueIndex("inbox_drafts_raw_message_idx").on(
      table.rawMessageId,
    ),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    transactionId: text("transaction_id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId),
    draftId: text("draft_id").references(() => inboxDrafts.draftId),
    rawMessageId: text("raw_message_id").references(() => rawMessages.rawMessageId),
    institutionCode: text("institution_code"),
    accountChannel: text("account_channel", { enum: accountChannels }).notNull(),
    transactionDirection: text("transaction_direction", {
      enum: transactionDirections,
    }).notNull(),
    eventKind: text("event_kind", { enum: transactionEventKinds })
      .notNull()
      .default("approved_sms"),
    amountMinor: integer("amount_minor").notNull(),
    feeMinor: integer("fee_minor").notNull().default(0),
    vatMinor: integer("vat_minor").notNull().default(0),
    serviceFeeMinor: integer("service_fee_minor").notNull().default(0),
    otherFeesMinor: integer("other_fees_minor").notNull().default(0),
    reportedBalanceMinor: integer("reported_balance_minor"),
    currencyCode: text("currency_code").notNull().default("ETB"),
    title: text("title").notNull(),
    merchantName: text("merchant_name"),
    category: text("category"),
    occurredAt: text("occurred_at").notNull(),
    approvedAt: text("approved_at").notNull(),
    accountReference: text("account_reference"),
    reference: text("reference"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    draftIdx: uniqueIndex("transactions_draft_idx").on(table.draftId),
  }),
);

export const reconciliationItems = sqliteTable("reconciliation_items", {
  reconciliationItemId: text("reconciliation_item_id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.accountId),
  transactionId: text("transaction_id").references(() => transactions.transactionId),
  rawMessageId: text("raw_message_id").references(() => rawMessages.rawMessageId),
  expectedBalanceMinor: integer("expected_balance_minor").notNull(),
  reportedBalanceMinor: integer("reported_balance_minor").notNull(),
  deltaMinor: integer("delta_minor").notNull(),
  status: text("status", { enum: reconciliationStatuses })
    .notNull()
    .default("pending"),
  resolutionKind: text("resolution_kind", {
    enum: reconciliationResolutionKinds,
  }),
  resolvedByTransactionId: text("resolved_by_transaction_id").references(
    () => transactions.transactionId,
  ),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const budgetRules = sqliteTable("budget_rules", {
  budgetRuleId: text("budget_rule_id").primaryKey(),
  label: text("label").notNull(),
  category: text("category"),
  accountId: text("account_id").references(() => accounts.accountId),
  direction: text("direction", { enum: transactionDirections }),
  limitMinor: integer("limit_minor").notNull(),
  currencyCode: text("currency_code").notNull().default("ETB"),
  cadence: text("cadence", { enum: budgetCadences }).notNull().default("monthly"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trustedDevices = sqliteTable("trusted_devices", {
  trustedDeviceId: text("trusted_device_id").primaryKey(),
  deviceLabel: text("device_label").notNull(),
  platform: text("platform", { enum: syncPlatforms }).notNull(),
  deviceState: text("device_state", { enum: trustedDeviceStates })
    .notNull()
    .default("trusted"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  autoSyncEnabled: integer("auto_sync_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  trustFingerprint: text("trust_fingerprint"),
  lastSeenAt: text("last_seen_at"),
  lastSyncedAt: text("last_synced_at"),
  pairedAt: text("paired_at").notNull(),
  revokedAt: text("revoked_at"),
  metadataJson: text("metadata_json"),
});

export const syncActivity = sqliteTable("sync_activity", {
  syncActivityId: text("sync_activity_id").primaryKey(),
  trustedDeviceId: text("trusted_device_id").references(
    () => trustedDevices.trustedDeviceId,
  ),
  activityType: text("activity_type", { enum: syncActivityTypes }).notNull(),
  status: text("status", { enum: syncActivityStatuses }).notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  payloadJson: text("payload_json"),
  occurredAt: text("occurred_at").notNull(),
});

export const sqliteSchema = {
  rawMessages,
  inboxDrafts,
  accounts,
  transactions,
  reconciliationItems,
  budgetRules,
  trustedDevices,
  syncActivity,
};

export type SQLiteSchema = typeof sqliteSchema;
