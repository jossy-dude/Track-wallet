import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "./SettingsScreen";

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

describe("SettingsScreen", () => {
  it("renders the new settings hub destinations and removes legacy parser-lab copy", () => {
    const html = renderToStaticMarkup(
      <SettingsScreen
        onOpenManageAccount={() => undefined}
        onOpenPage={() => undefined}
      />,
    );

    expect(html).toContain("Settings Hub");
    expect(html).toContain("Appearance");
    expect(html).toContain("Security &amp; Privacy");
    expect(html).toContain("Sync &amp; Devices");
    expect(html).toContain("Parsing Engine");
    expect(html).toContain("SMS Forwarding");
    expect(html).not.toContain("Developer parser lab");
    expect(html).not.toContain("Settings and Sync Hub");
  });

  it("calls onOpenPage with the tapped destination id", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);
    const onOpenPage = vi.fn();

    act(() => {
      root.render(
        <SettingsScreen
          onOpenManageAccount={() => undefined}
          onOpenPage={onOpenPage}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const syncButton = buttons.find((button: HTMLButtonElement) =>
      button.textContent?.includes("Sync & Devices"),
    );

    expect(syncButton).toBeDefined();

    act(() => {
      syncButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenPage).toHaveBeenCalledWith("sync");

    act(() => {
      root.unmount();
    });
  });

  it("routes manage account through the settings detail system", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);
    const onOpenManageAccount = vi.fn();
    const onOpenPage = vi.fn();

    act(() => {
      root.render(
        <SettingsScreen
          onOpenManageAccount={onOpenManageAccount}
          onOpenPage={onOpenPage}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const manageAccountButton = buttons.find((button: HTMLButtonElement) =>
      button.textContent?.includes("Manage Account"),
    );

    expect(manageAccountButton).toBeDefined();

    act(() => {
      manageAccountButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onOpenManageAccount).toHaveBeenCalled();
    expect(onOpenPage).not.toHaveBeenCalledWith("account");

    act(() => {
      root.unmount();
    });
  });
});
