import { clearBudgetWorkspacePreferences } from "./budgetPreferences";
import { clearFinanceLinkedDisplayPreferences } from "./displayPreferences";
import {
  persistSetupChecklistPending,
  readDemoModeEnabled,
} from "./setupPreferences";

export function clearFinanceLinkedLocalState(options?: {
  reopenSetupChecklist?: boolean;
}) {
  clearFinanceLinkedDisplayPreferences();
  clearBudgetWorkspacePreferences();

  if (options?.reopenSetupChecklist ?? !readDemoModeEnabled()) {
    persistSetupChecklistPending(true);
  }
}
