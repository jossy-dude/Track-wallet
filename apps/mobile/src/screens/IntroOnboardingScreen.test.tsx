import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IntroOnboardingScreen,
  type IntroOnboardingPage,
} from "./IntroOnboardingScreen";

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

function renderIntoDom(component: React.ReactNode) {
  document.body.innerHTML = "<div id=\"root\"></div>";
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Expected test root container to exist");
  }

  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("IntroOnboardingScreen", () => {
  it("renders the Track Wallet onboarding story with concise setup-first copy", () => {
    const html = renderToStaticMarkup(
      <IntroOnboardingScreen onComplete={() => undefined} />,
    );

    expect(html).toContain("tw-motion-page");
    expect(html).toContain("tw-motion-page-showcase");
    expect(html).toContain("Choose how this phone should start");
    expect(html).toContain("Private or showcase");
    expect(html).toContain(
      "Showcase loads sample balances, budgets, and inbox drafts on this phone. Skip if you want to start private and empty.",
    );
    expect(html).toContain("private empty wallet");
    expect(html).toContain("Start private");
    expect(html).toContain("Try showcase");
    expect(html).toContain("4 pages");
    expect(html).not.toContain("Sign in with Google");
    expect(html).not.toContain("Set the password before the money moves");
  });

  it("advances through pages and calls onPageChange with the active page", () => {
    const onPageChange = vi.fn();
    const screen = renderIntoDom(
      <IntroOnboardingScreen
        onComplete={() => undefined}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.container.textContent).toContain(
      "Choose how this phone should start",
    );
    expect(onPageChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "start" }),
      0,
    );

    const tryShowcaseButton = Array.from(
      screen.container.querySelectorAll("button"),
    ).find((button: HTMLButtonElement) =>
      button.textContent?.includes("Try showcase"),
    );

    expect(tryShowcaseButton).toBeDefined();

    act(() => {
      tryShowcaseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(screen.container.textContent).toContain(
      "Messages and manual entry share one lane",
    );
    expect(onPageChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "capture" }),
      1,
    );

    screen.unmount();
  });

  it("calls onSkip with the current page context from the private-first choice", () => {
    const onSkip = vi.fn();
    const screen = renderIntoDom(
      <IntroOnboardingScreen onComplete={() => undefined} onSkip={onSkip} />,
    );

    const startPrivateButton = Array.from(
      screen.container.querySelectorAll("button"),
    ).find(
      (button: HTMLButtonElement) => button.textContent?.includes("Start private"),
    );

    expect(startPrivateButton).toBeDefined();

    act(() => {
      startPrivateButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onSkip).toHaveBeenCalledWith(
      expect.objectContaining({ id: "start" }),
      0,
    );

    screen.unmount();
  });

  it("lets the user choose showcase explicitly from the first page", () => {
    const onComplete = vi.fn();
    const screen = renderIntoDom(
      <IntroOnboardingScreen onComplete={onComplete} />,
    );

    const tryShowcaseButton = Array.from(
      screen.container.querySelectorAll("button"),
    ).find((button: HTMLButtonElement) =>
      button.textContent?.includes("Try showcase"),
    );

    expect(tryShowcaseButton).toBeDefined();

    act(() => {
      tryShowcaseButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain(
      "Messages and manual entry share one lane",
    );
    expect(onComplete).not.toHaveBeenCalled();

    screen.unmount();
  });

  it("supports custom pages and completes on the last page", () => {
    const customPages: readonly IntroOnboardingPage[] = [
      {
        id: "one",
        eyebrow: "One",
        title: "Alpha setup",
        description: "First custom page",
        highlightLabel: "Alpha",
        accent: "primary",
        illustration: "password-vault",
        bullets: [
          {
            icon: "lock",
            title: "Secure",
            description: "Keep setup protected",
          },
        ],
      },
      {
        id: "two",
        eyebrow: "Two",
        title: "Beta review",
        description: "Second custom page",
        highlightLabel: "Beta",
        accent: "secondary",
        illustration: "approval-stack",
        bullets: [
          {
            icon: "task_alt",
            title: "Approve",
            description: "Review before posting",
          },
        ],
      },
    ];
    const onComplete = vi.fn();
    const screen = renderIntoDom(
      <IntroOnboardingScreen
        completeLabel="Launch wallet"
        nextLabel="Forward"
        onComplete={onComplete}
        pages={customPages}
      />,
    );

    expect(screen.container.textContent).toContain("Alpha setup");

    const forwardButton = Array.from(
      screen.container.querySelectorAll("button"),
    ).find((button: HTMLButtonElement) =>
      button.textContent?.includes("Forward"),
    );

    expect(forwardButton).toBeDefined();

    act(() => {
      forwardButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(screen.container.textContent).toContain("Beta review");
    expect(screen.container.textContent).toContain("Launch wallet");

    const completeButton = Array.from(
      screen.container.querySelectorAll("button"),
    ).find((button: HTMLButtonElement) =>
      button.textContent?.includes("Launch wallet"),
    );

    expect(completeButton).toBeDefined();

    act(() => {
      completeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "two" }),
      1,
    );

    screen.unmount();
  });
});
