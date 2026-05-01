import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  demoAccountSummaries,
  demoApprovedTransactions,
} from "@omni-sync/database";

import { CardsScreen } from "./CardsScreen";

describe("CardsScreen", () => {
  it("renders the analytics-first account view instead of the old wallet-stack screen", () => {
    const props: any = {
      accountActivity: [],
      accountCards: [],
      accountCount: 0,
      balanceBreakdownItems: [],
      topBalanceDisplay: "ETB 0.00",
      topInstitutionHeadline: "No accounts",
      totalBalanceDisplay: "ETB 0.00",
      visibleChannelCount: 0,
      approvedTransactions: demoApprovedTransactions,
      accountSummaries: demoAccountSummaries,
    };

    const html = renderToStaticMarkup(
      <CardsScreen {...props} />,
    );

    expect(html).toContain("Total tracked balance");
    expect(html).toContain("Account mix");
    expect(html).toContain("Balance ladder");
    expect(html).toContain("Income pulse");
    expect(html).toContain("Last active");
    expect(html).not.toContain("Wallet stack");
    expect(html).not.toContain("Recent Account Activity");
  });
});
