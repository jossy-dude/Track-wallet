// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InboxPanel } from "./InboxPanel";

describe("InboxPanel", () => {
  it("uses user-language empty state guidance", () => {
    const markup = renderToStaticMarkup(
      <InboxPanel pendingCount={0} title="Ready to review" transactions={[]} />,
    );

    expect(markup).toContain("Nothing is waiting for review yet.");
    expect(markup).toContain(
      "Add a manual transaction or finish SMS setup to start your inbox.",
    );
    expect(markup).not.toContain("Queue a parser test");
  });
});
