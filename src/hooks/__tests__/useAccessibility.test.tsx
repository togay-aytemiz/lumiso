import { render, fireEvent } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import {
  useFocusTrap,
  useScreenReader,
  useKeyboardNavigation,
  useReducedMotion,
  useHighContrast,
} from "../useAccessibility";

describe("useFocusTrap", () => {
  it("focuses the first element and traps tab navigation", () => {
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "outside";
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const TestComponent = () => {
      const ref = useFocusTrap(true);
      return (
        <div ref={ref}>
          <button>first</button>
          <button>second</button>
        </div>
      );
    };

    const { unmount, getByText } = render(<TestComponent />);
    const first = getByText("first");
    const second = getByText("second");

    expect(document.activeElement).toBe(first);

    second.focus();
    fireEvent.keyDown(second.parentElement as Element, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first.parentElement as Element, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(second);

    unmount();
    expect(document.activeElement).toBe(outsideButton);

    document.body.removeChild(outsideButton);
  });
});

describe("useScreenReader", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("announces messages and clears them after timeout", () => {
    const { result, unmount } = renderHook(() => useScreenReader());

    act(() => {
      result.current.announce("hello world", "assertive");
    });

    const announcer = document.body.querySelector('[aria-live]') as HTMLDivElement;
    expect(announcer).toBeTruthy();
    expect(announcer.getAttribute("aria-live")).toBe("assertive");
    expect(announcer.textContent).toBe("hello world");

    act(() => {
      jest.runAllTimers();
    });
    expect(announcer.textContent).toBe("");

    unmount();
    expect(document.body.contains(announcer)).toBe(false);
  });
});

describe("useKeyboardNavigation", () => {
  it("updates active index and triggers selection", () => {
    const items = ["one", "two", "three"];
    const onSelect = jest.fn();

    const TestComponent = () => {
      const { handleKeyDown, setActiveIndex, containerRef } = useKeyboardNavigation(items, onSelect, -1);

      return (
        <div ref={containerRef} onKeyDown={handleKeyDown} role="listbox">
          {items.map((item, index) => (
            <div key={item} data-index={index} id={`item-${index}`}>
              {item}
            </div>
          ))}
          <button onClick={() => setActiveIndex(1)}>Set Second</button>
        </div>
      );
    };

    const { getByRole, getByText } = render(<TestComponent />);
    const container = getByRole("listbox");

    act(() => {
      fireEvent.keyDown(container, { key: "ArrowDown" });
      fireEvent.keyDown(container, { key: "ArrowDown" });
    });

    expect(container.getAttribute("aria-activedescendant")).toBe("item-1");

    act(() => {
      fireEvent.keyDown(container, { key: "Enter" });
    });
    expect(onSelect).toHaveBeenCalledWith("two", 1);

    act(() => {
      fireEvent.keyDown(container, { key: "End" });
    });
    expect(container.getAttribute("aria-activedescendant")).toBe("item-2");

    act(() => {
      fireEvent.click(getByText("Set Second"));
    });
    expect(container.getAttribute("aria-activedescendant")).toBe("item-1");
  });
});

describe("motion and contrast hooks", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("tracks reduced motion preference", () => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      },
      removeEventListener: jest.fn(),
    }));

    const { result, rerender } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    rerender();
    expect(result.current).toBe(true);

    act(() => {
      listeners[0]({ matches: false } as MediaQueryListEvent);
    });
    rerender();
    expect(result.current).toBe(false);
  });

  it("tracks high contrast preference", () => {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-contrast: high)",
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      },
      removeEventListener: jest.fn(),
    }));

    const { result, rerender } = renderHook(() => useHighContrast());
    expect(result.current).toBe(false);

    rerender();
    expect(result.current).toBe(true);

    act(() => {
      listeners[0]({ matches: false } as MediaQueryListEvent);
    });
    rerender();
    expect(result.current).toBe(false);
  });
});
