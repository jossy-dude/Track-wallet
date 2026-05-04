import { transactionStore } from "@omni-sync/database";

import { clearFinanceLinkedLocalState } from "./preferences/clearFinanceLocalState";
import { clearParserWorkspacePreferences } from "./preferences/parserPreferences";
import { smsCaptureBridge } from "./sms";

export async function clearLocalFinanceWorkspace(options?: {
  reopenSetupChecklist?: boolean;
}) {
  clearFinanceLinkedLocalState(options);
  clearParserWorkspacePreferences();

  let nativeRuntimeCleared = false;
  try {
    await smsCaptureBridge.clearRuntimeState();
    nativeRuntimeCleared = true;
  } catch {
    nativeRuntimeCleared = false;
  }

  transactionStore.getState().clearAllData();

  return {
    nativeRuntimeCleared,
  };
}
