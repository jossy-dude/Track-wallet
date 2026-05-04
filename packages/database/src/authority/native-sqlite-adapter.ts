import type {
  AuthorityMode,
  ReconciliationItem,
  StorageBootstrapState,
} from "@omni-sync/core";

import {
  createSQLiteStateStorage,
  type SQLiteBinaryStorage,
  type SQLiteStateStorage,
} from "../sqlite/state-storage";
import {
  cloneReconciliationItems,
  type AuthorityAdapter,
  type AuthorityAdapterDescriptor,
  type AuthorityAdapterSeed,
  type AuthorityBootstrapResult,
} from "./types";

const RECONCILIATION_STORAGE_KEY =
  "native-sqlite-authority:reconciliation-items";
const NATIVE_SQLITE_ALPHA_WARNING =
  "Native SQLite authority now persists alpha data in a local SQLite-backed store. Table-level repositories and reconciliation write-through are still incomplete.";

export interface NativeSqliteAuthorityAdapterOptions extends AuthorityAdapterSeed {
  mode?: AuthorityMode;
  sqliteStateStorage?: SQLiteStateStorage;
  binaryStorage?: SQLiteBinaryStorage;
}

function parseReconciliationItems(value: string): ReconciliationItem[] {
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? cloneReconciliationItems(parsed) : [];
}

export class NativeSqliteAuthorityAdapter implements AuthorityAdapter {
  readonly runtime = "native_mobile";
  readonly previewOnly = false;

  #mode: AuthorityMode;
  #bootstrapState: StorageBootstrapState = "idle";
  #sqliteStateStorage: SQLiteStateStorage;
  #seededReconciliationItems: ReconciliationItem[];

  constructor(options: NativeSqliteAuthorityAdapterOptions | AuthorityMode = "real") {
    if (typeof options === "string") {
      this.#mode = options;
      this.#sqliteStateStorage = createSQLiteStateStorage();
      this.#seededReconciliationItems = [];
      return;
    }

    this.#mode = options.mode ?? "real";
    this.#sqliteStateStorage =
      options.sqliteStateStorage ??
      createSQLiteStateStorage({
        binaryStorage: options.binaryStorage,
      });
    this.#seededReconciliationItems = cloneReconciliationItems(
      options.reconciliationItems ?? [],
    );
  }

  get mode(): AuthorityMode {
    return this.#mode;
  }

  describe(): AuthorityAdapterDescriptor {
    return {
      key: "native-sqlite-authority",
      label: "Native Mobile SQLite Authority",
      runtime: this.runtime,
      mode: this.mode,
      bootstrapState: this.#bootstrapState,
      previewOnly: this.previewOnly,
      capabilities: {
        persistent: true,
        browserSafe: false,
        supportsTransactions: true,
        supportsReconciliation: true,
        supportsLegacyImport: true,
      },
      warnings: [NATIVE_SQLITE_ALPHA_WARNING],
    };
  }

  async bootstrap(): Promise<AuthorityBootstrapResult> {
    this.#bootstrapState = "hydrating";

    try {
      const storedValue = await this.#sqliteStateStorage.getItem(
        RECONCILIATION_STORAGE_KEY,
      );
      const reconciliationItems =
        storedValue == null
          ? cloneReconciliationItems(this.#seededReconciliationItems)
          : parseReconciliationItems(storedValue);

      if (storedValue == null && reconciliationItems.length > 0) {
        await this.#sqliteStateStorage.setItem(
          RECONCILIATION_STORAGE_KEY,
          JSON.stringify(reconciliationItems),
        );
        await this.#sqliteStateStorage.flush();
      }

      this.#seededReconciliationItems = cloneReconciliationItems(
        reconciliationItems,
      );
      this.#bootstrapState = "ready";

      return {
        descriptor: this.describe(),
        reconciliationItems: cloneReconciliationItems(reconciliationItems),
      };
    } catch (error) {
      this.#bootstrapState = "failed";
      throw error;
    }
  }

  async listReconciliationItems(): Promise<readonly ReconciliationItem[]> {
    if (this.#bootstrapState !== "ready") {
      return (await this.bootstrap()).reconciliationItems;
    }

    const storedValue = await this.#sqliteStateStorage.getItem(
      RECONCILIATION_STORAGE_KEY,
    );
    return storedValue == null ? [] : parseReconciliationItems(storedValue);
  }

  async reset(): Promise<void> {
    await this.#sqliteStateStorage.clearAll();
    await this.#sqliteStateStorage.flush();
    this.#seededReconciliationItems = [];
    this.#bootstrapState = "idle";
  }
}

export function createNativeSqliteAuthorityAdapter(
  options?: NativeSqliteAuthorityAdapterOptions | AuthorityMode,
): NativeSqliteAuthorityAdapter {
  return new NativeSqliteAuthorityAdapter(options);
}
