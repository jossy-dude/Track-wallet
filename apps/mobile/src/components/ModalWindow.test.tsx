import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalWindow } from "./ModalWindow";

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  vi.useRealTimers();
});

function renderModalWindow(isOpen: boolean, onClose = () => undefined) {
  document.body.innerHTML = "<div id=\"root\"></div>";
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Expected test root container to exist");
  }

  const root = createRoot(container);

  function render(nextIsOpen: boolean) {
    act(() => {
      root.render(
        <ModalWindow
          isOpen={nextIsOpen}
          onClose={onClose}
          subtitle="Subtitle"
          title="Window title"
        >
          <div>Window content</div>
        </ModalWindow>,
      );
    });
  }

  render(isOpen);

  return {
    container,
    rerender(nextIsOpen: boolean) {
      render(nextIsOpen);
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("ModalWindow", () => {
  it("keeps the window mounted briefly so the closing motion state can play", () => {
    const screen = renderModalWindow(true);

    expect(screen.container.textContent).toContain("Window title");

    screen.rerender(false);

    expect(screen.container.textContent).toContain("Window title");
    expect(
      screen.container.querySelector('[data-motion-state="closing"]'),
    ).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(280);
    });

    expect(screen.container.textContent).not.toContain("Window title");

    screen.unmount();
  });
});
