import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TruncatedTextWithTooltip } from "../TruncatedTextWithTooltip";

describe("TruncatedTextWithTooltip", () => {
  let originalRAF: typeof window.requestAnimationFrame;
  let originalCancelRAF: typeof window.cancelAnimationFrame;
  let resizeObserverMock: jest.Mock;

  beforeEach(() => {
    originalRAF = window.requestAnimationFrame;
    originalCancelRAF = window.cancelAnimationFrame;
    resizeObserverMock = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
    }));
    (window as any).ResizeObserver = resizeObserverMock;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancelRAF;
  });

  it("returns null when no text provided", () => {
    const { container } = render(<TruncatedTextWithTooltip text="" />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render tooltip content when text fits", async () => {
    let frameCallback: FrameRequestCallback | null = null;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1 as unknown as number;
    };
    window.cancelAnimationFrame = jest.fn();

    const user = userEvent.setup();
    render(<TruncatedTextWithTooltip text="Visible" delayDuration={0} />);

    const textElement = screen.getByText("Visible");
    Object.defineProperty(textElement, "scrollHeight", { value: 20, configurable: true });
    Object.defineProperty(textElement, "clientHeight", { value: 20, configurable: true });
    Object.defineProperty(textElement, "scrollWidth", { value: 20, configurable: true });
    Object.defineProperty(textElement, "clientWidth", { value: 20, configurable: true });

    await act(async () => {
      frameCallback?.(performance.now());
    });

    await user.hover(textElement);

    await waitFor(() => {
      expect(screen.getAllByText("Visible")).toHaveLength(1);
    });
  });

  it("renders tooltip content when text is truncated", async () => {
    let frameCallback: FrameRequestCallback | null = null;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1 as unknown as number;
    };
    window.cancelAnimationFrame = jest.fn();

    const user = userEvent.setup();
    render(
      <TruncatedTextWithTooltip
        text="This is a very long piece of text"
        lines={1}
        delayDuration={0}
      />
    );

    const textElement = screen.getByText("This is a very long piece of text");
    Object.defineProperty(textElement, "scrollHeight", { value: 120, configurable: true });
    Object.defineProperty(textElement, "clientHeight", { value: 20, configurable: true });
    Object.defineProperty(textElement, "scrollWidth", { value: 200, configurable: true });
    Object.defineProperty(textElement, "clientWidth", { value: 100, configurable: true });

    await act(async () => {
      frameCallback?.(performance.now());
    });

    await user.hover(textElement);

    const occurrences = await screen.findAllByText("This is a very long piece of text");
    expect(occurrences.length).toBeGreaterThan(1);
  });
});
