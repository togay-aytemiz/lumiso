import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "initial", delay: 200 },
    });

    expect(result.current).toBe("initial");
  });

  it("delays updates until the debounce interval elapses", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "first", delay: 150 },
    });

    rerender({ value: "second", delay: 150 });
    expect(result.current).toBe("first");

    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(result.current).toBe("first");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("second");
  });

  it("clears pending timers on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const { rerender, unmount } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "start", delay: 300 },
    });

    rerender({ value: "end", delay: 300 });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
