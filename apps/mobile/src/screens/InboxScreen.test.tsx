import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { InboxScreen } from "./InboxScreen";

describe("InboxScreen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("uses first-run language that points people to manual entry and SMS setup", () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(
        <InboxScreen
          inboxTransactions={[]}
          onApproveTransaction={() => undefined}
          onDismissUnmatchedMessage={() => undefined}
          onEditTransaction={() => undefined}
          onOpenSettings={() => undefined}
          onRejectTransaction={() => undefined}
          pendingCount={0}
          pendingInstitutionCount={0}
          pendingValueDisplay="ETB 0.00"
          recentApprovedActivity={[]}
          showFirstUseGuidance
          unmatchedCount={0}
          unmatchedMessages={[]}
        />,
      );
    });

    expect(container.textContent).toContain("Add a manual transaction");
    expect(container.textContent).toContain("Set up SMS capture");
    expect(container.textContent).not.toContain(
      "No pending SMS approvals. Queue a parser test or wait for new bank messages.",
    );

    act(() => {
      root.unmount();
    });
  });
});
