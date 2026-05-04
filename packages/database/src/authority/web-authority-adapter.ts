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

const WEB_PREVIEW_WARNING =
  "Browser preview authority is an in-memory placeholder until the SQLite boundary is wired.";

export class WebAuthorityAdapter implements AuthorityAdapter {
  readonly runtime = "web";
  readonly previewOnly = true;

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
      key: "web-preview-authority",
      label: "Web Preview Authority",
      runtime: this.runtime,
      mode: this.mode,
      bootstrapState: this.#bootstrapState,
      previewOnly: this.previewOnly,
      capabilities: {
        persistent: false,
        browserSafe: true,
        supportsTransactions: false,
        supportsReconciliation: true,
        supportsLegacyImport: false,
      },
      warnings: [WEB_PREVIEW_WARNING],
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

export function createWebAuthorityAdapter(
  options?: AuthorityAdapterSeed & { mode?: AuthorityMode },
): WebAuthorityAdapter {
  return new WebAuthorityAdapter(options);
}
