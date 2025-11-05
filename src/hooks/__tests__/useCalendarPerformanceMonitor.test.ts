jest.mock("@/utils/performance", () => ({
  performanceMonitor: {
    startTiming: jest.fn(),
    endTiming: jest.fn(),
  },
}));

import { renderHook, act } from "@testing-library/react";

import { useCalendarPerformanceMonitor } from "../useCalendarPerformanceMonitor";
import { performanceMonitor } from "@/utils/performance";

const startTimingMock = performanceMonitor.startTiming as jest.Mock;
const endTimingMock = performanceMonitor.endTiming as jest.Mock;

describe("useCalendarPerformanceMonitor", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("tracks timings and provides performance summary", () => {
    endTimingMock.mockReturnValueOnce(40); // render
    endTimingMock.mockReturnValueOnce(150); // query
    endTimingMock.mockReturnValueOnce(20); // events

    const { result } = renderHook(() => useCalendarPerformanceMonitor());

    act(() => {
      result.current.startRenderTiming();
    });
    expect(startTimingMock).toHaveBeenCalledWith("calendar-render");

    act(() => {
      result.current.endRenderTiming();
    });
    expect(endTimingMock).toHaveBeenCalledWith("calendar-render");
    expect(result.current.metrics.renderTime).toBe(40);

    act(() => {
      result.current.startQueryTiming();
      result.current.endQueryTiming();
    });
    expect(endTimingMock).toHaveBeenCalledWith("calendar-query");
    expect(result.current.metrics.queryTime).toBe(150);

    act(() => {
      result.current.startEventProcessing();
      result.current.endEventProcessing(5);
    });
    expect(endTimingMock).toHaveBeenCalledWith("calendar-event-processing");
    expect(result.current.metrics.eventProcessingTime).toBe(20);
    expect(result.current.metrics.totalEvents).toBe(5);

    const summary = result.current.getPerformanceSummary();
    expect(summary.totalTime).toBe(40 + 150 + 20);
    expect(summary.eventsPerSecond).toBe("250.00");
    expect(summary.grade).toBe("A");
  });

  it("updates memory usage from performance API", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.performance,
      "memory"
    );
    Object.defineProperty(globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory }, "memory", {
      value: {
        usedJSHeapSize: 150 * 1024 * 1024,
        totalJSHeapSize: 300 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024,
      },
      configurable: true,
    });

    const { result } = renderHook(() => useCalendarPerformanceMonitor());

    act(() => {
      result.current.updateMemoryUsage();
    });

    expect(result.current.metrics.memoryUsage).toEqual({
      used: 150,
      total: 300,
      limit: 200,
    });

    if (originalDescriptor) {
      Object.defineProperty(
        globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory },
        "memory",
        originalDescriptor
      );
    } else {
      delete (globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory }).memory;
    }
  });

  it("warns in development for slow operations and high memory", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation(() => 0 as ReturnType<typeof setInterval>);
    const clearIntervalSpy = jest
      .spyOn(global, "clearInterval")
      .mockImplementation(() => undefined);

    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.performance,
      "memory"
    );
    Object.defineProperty(globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory }, "memory", {
      value: {
        usedJSHeapSize: 190 * 1024 * 1024,
        totalJSHeapSize: 250 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024,
      },
      configurable: true,
    });

    endTimingMock
      .mockReturnValueOnce(150) // render
      .mockReturnValueOnce(600) // query
      .mockReturnValueOnce(80); // event processing

    const { result, unmount } = renderHook(() => useCalendarPerformanceMonitor());

    act(() => {
      result.current.endRenderTiming();
      result.current.endQueryTiming();
      result.current.endEventProcessing(10);
      result.current.updateMemoryUsage();
    });

    expect(warnSpy.mock.calls.some(([msg]) => msg.includes("Slow render"))).toBe(true);
    expect(warnSpy.mock.calls.some(([msg]) => msg.includes("Slow query"))).toBe(true);
    expect(warnSpy.mock.calls.some(([msg]) => msg.includes("Slow event processing"))).toBe(true);
    expect(warnSpy.mock.calls.some(([msg]) => msg.includes("High memory usage"))).toBe(true);

    unmount();

    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    if (originalDescriptor) {
      Object.defineProperty(
        globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory },
        "memory",
        originalDescriptor
      );
    } else {
      delete (globalThis.performance as typeof globalThis.performance & { memory?: PerformanceMemory }).memory;
    }
  });
});
