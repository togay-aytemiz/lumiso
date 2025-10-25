import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { LongPressButton } from "../long-press-button";

describe("LongPressButton", () => {
  let requestAnimationFrameSpy: jest.SpyInstance<number, [FrameRequestCallback]>;
  let cancelAnimationFrameSpy: jest.SpyInstance<void, [number]>;

  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });

    requestAnimationFrameSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1);

    cancelAnimationFrameSpy = jest
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    jest.useRealTimers();
  });

  it("shows holding feedback while pressed and resets on early release", () => {
    const onConfirm = jest.fn();
    const { getByRole } = render(
      <LongPressButton
        label="Hold to confirm"
        holdingLabel="Holding"
        onConfirm={onConfirm}
        duration={2000}
      />
    );

    const button = getByRole("button");

    act(() => {
      fireEvent.mouseDown(button);
    });

    expect(button).toHaveTextContent("Holding 2.0s");

    act(() => {
      jest.advanceTimersByTime(500);
      fireEvent.mouseUp(button);
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(button).toHaveTextContent("Hold to confirm");
  });

  it("confirms after the hold duration and shows completion state before resetting", () => {
    const onConfirm = jest.fn();
    const { getByRole } = render(
      <LongPressButton
        label="Hold"
        completeLabel="Done"
        holdingLabel="Holding"
        onConfirm={onConfirm}
        duration={1000}
      />
    );

    const button = getByRole("button");

    act(() => {
      fireEvent.mouseDown(button);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent("Done");

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(button).toHaveTextContent("Hold");
  });
});
