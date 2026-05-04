import type {
  AuthorityMode,
  AuthorityRuntime,
  ReconciliationItem,
  StorageBootstrapState,
} from "@omni-sync/core";

export interface AuthorityAdapterCapabilities {
  readonly persistent: boolean;
  readonly browserSafe: boolean;
  readonly supportsTransactions: boolean;
  readonly supportsReconciliation: boolean;
  readonly supportsLegacyImport: boolean;
}

export interface AuthorityAdapterDescriptor {
  readonly key: string;
  readonly label: string;
  readonly runtime: AuthorityRuntime;
  readonly mode: AuthorityMode;
  readonly bootstrapState: StorageBootstrapState;
  readonly previewOnly: boolean;
  readonly capabilities: AuthorityAdapterCapabilities;
  readonly warnings: readonly string[];
}

export interface AuthorityBootstrapResult {
  readonly descriptor: AuthorityAdapterDescriptor;
  readonly reconciliationItems: readonly ReconciliationItem[];
}

export interface AuthorityAdapterSeed {
  readonly reconciliationItems?: readonly ReconciliationItem[];
}

export interface AuthorityAdapter {
  readonly runtime: AuthorityRuntime;
  readonly mode: AuthorityMode;
  readonly previewOnly: boolean;
  describe(): AuthorityAdapterDescriptor;
  bootstrap(): Promise<AuthorityBootstrapResult>;
  listReconciliationItems(): Promise<readonly ReconciliationItem[]>;
  reset(): Promise<void>;
}

export class AuthorityAdapterNotImplementedError extends Error {
  readonly runtime: AuthorityRuntime;

  constructor(runtime: AuthorityRuntime, message: string) {
    super(message);
    this.name = "AuthorityAdapterNotImplementedError";
    this.runtime = runtime;
  }
}

export function cloneReconciliationItems(
  items: readonly ReconciliationItem[],
): ReconciliationItem[] {
  return items.map((item) => ({ ...item }));
}
