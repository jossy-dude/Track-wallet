import type {
  AuthorityMode,
  ReconciliationItem,
  StorageBootstrapState,
} from "@omni-sync/core";

import {
  cloneReconciliationItems,
  type AuthorityAdapter,
  type AuthorityAdapterDescriptor,
  type AuthorityAdapterSeed,
  type AuthorityBootstrapResult,
} from "./types";

export class MemoryAuthorityAdapter implements AuthorityAdapter {
  readonly runtime = "memory";
  readonly previewOnly = false;

  #mode: AuthorityMode;
  #bootstrapState: StorageBootstrapState = "idle";
  #reconciliationItems: ReconciliationItem[];

  constructor({
    mode = "real",
    reconciliationItems = [],
  }: AuthorityAdapterSeed & { mode?: AuthorityMode } = {}) {
    this.#mode = mode;
    this.#reconciliationItems = cloneReconciliationItems(reconciliationItems);
  }

  get mode(): AuthorityMode {
    return this.#mode;
  }

  describe(): AuthorityAdapterDescriptor {
    return {
      key: "memory-authority",
      label: "Memory Authority",
      runtime: this.runtime,
      mode: this.mode,
      bootstrapState: this.#bootstrapState,
      previewOnly: this.previewOnly,
      capabilities: {
        persistent: false,
        browserSafe: true,
        supportsTransactions: false,
        supportsReconciliation: true,
        supportsLegacyImport: true,
      },
      warnings: [],
    };
  }

  async bootstrap(): Promise<AuthorityBootstrapResult> {
    this.#bootstrapState = "ready";

    return {
      descriptor: this.describe(),
      reconciliationItems: cloneReconciliationItems(this.#reconciliationItems),
    };
  }

  async listReconciliationItems(): Promise<readonly ReconciliationItem[]> {
    return cloneReconciliationItems(this.#reconciliationItems);
  }

  async reset(): Promise<void> {
    this.#reconciliationItems = [];
    this.#bootstrapState = "idle";
  }
}

export function createMemoryAuthorityAdapter(
  options?: AuthorityAdapterSeed & { mode?: AuthorityMode },
): MemoryAuthorityAdapter {
  return new MemoryAuthorityAdapter(options);
}
