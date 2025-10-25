import { act, renderHook } from "@testing-library/react";
import { useIsMobile } from "../use-mobile";

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  const listeners: Record<string, Array<(event: MediaQueryListEvent) => void>> = {};

  beforeEach(() => {
    listeners["(max-width: 767px)"] = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: window.innerWidth < 768,
      addEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        listeners[query] = listeners[query] || [];
        listeners[query].push(handler);
      },
      removeEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (!listeners[query]) return;
        listeners[query] = listeners[query].filter((fn) => fn !== handler);
      },
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, writable: true });
  });

  it("returns true when viewport is below the breakpoint", () => {
    Object.defineProperty(window, "innerWidth", { value: 500, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is above the breakpoint", () => {
    Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when media query change fires", () => {
    Object.defineProperty(window, "innerWidth", { value: 900, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    Object.defineProperty(window, "innerWidth", { value: 600, writable: true });
    act(() => {
      listeners["(max-width: 767px)"].forEach((handler) =>
        handler({ matches: true } as MediaQueryListEvent)
      );
    });

    expect(result.current).toBe(true);
  });
});
