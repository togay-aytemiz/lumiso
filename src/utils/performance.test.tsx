import React from "react";
import { render, act } from "@testing-library/react";
import { performanceMonitor, measurePerformance, useMeasureRender, checkMemoryUsage } from "./performance";

const withFreshMonitor = (fn: (monitor: typeof performanceMonitor) => void) => {
  jest.isolateModules(() => {
    const module = require("./performance") as typeof import("./performance");
    const MonitorClass = module.performanceMonitor.constructor as new () => typeof module.performanceMonitor;
    const monitor = new MonitorClass();
    fn(monitor);
  });
};

describe("performanceMonitor", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it("records timing metrics and returns duration", () => {
    let recordedDuration = 0;
    let metrics: Array<{ name: string; value: number; timestamp: number }> = [];
    let currentTime = 150;
    jest.spyOn(performance, "now").mockImplementation(() => currentTime);
    jest.spyOn(Date, "now").mockReturnValue(1_700_000);

    withFreshMonitor((monitor) => {
      monitor.startTiming("initial-load");
      currentTime = 310;
      recordedDuration = monitor.endTiming("initial-load");
      metrics = monitor.getMetrics();
    });

    expect(recordedDuration).toBeCloseTo(160);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      name: "initial-load",
      value: expect.any(Number),
      timestamp: 1_700_000,
    });
  });

  it("warns when endTiming is called without a start", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    let duration = 0;

    withFreshMonitor((monitor) => {
      duration = monitor.endTiming("missing-metric");
    });

    expect(duration).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith("No start time found for metric: missing-metric");
    warnSpy.mockRestore();
  });

  it("logs slow operations in development mode", () => {
    process.env.NODE_ENV = "development";
    let currentTime = 75;
    jest.spyOn(performance, "now").mockImplementation(() => currentTime);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    withFreshMonitor((monitor) => {
      monitor.startTiming("slow-task");
      currentTime = 240;
      monitor.endTiming("slow-task");
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slow operation detected: slow-task took")
    );
    warnSpy.mockRestore();
  });

  it("computes average time across metrics", () => {
    let currentTime = 200;
    jest.spyOn(performance, "now").mockImplementation(() => currentTime);
    let average = 0;
    let otherAverage = -1;

    withFreshMonitor((monitor) => {
      monitor.startTiming("task");
      currentTime = 300;
      monitor.endTiming("task");

      currentTime = 400;
      monitor.startTiming("task");
      currentTime = 520;
      monitor.endTiming("task");

      average = monitor.getAverageTime("task");
      otherAverage = monitor.getAverageTime("other");
    });

    expect(average).toBeCloseTo(110);
    expect(otherAverage).toBe(0);
  });
});

describe("measurePerformance decorator", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("wraps synchronous methods", () => {
    const startSpy = jest.spyOn(performanceMonitor, "startTiming").mockImplementation(() => {});
    const endSpy = jest.spyOn(performanceMonitor, "endTiming").mockImplementation(() => 0);

    class Demo {
      run() {
        return "done";
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(Demo.prototype, "run")!;
    measurePerformance(Demo.prototype, "run", descriptor);
    Object.defineProperty(Demo.prototype, "run", descriptor);

    const instance = new Demo();
    instance.run();

    expect(startSpy).toHaveBeenCalledWith("Demo.run");
    expect(endSpy).toHaveBeenCalledWith("Demo.run");
  });

  it("awaits async methods before ending timing", async () => {
    const startSpy = jest.spyOn(performanceMonitor, "startTiming").mockImplementation(() => {});
    const endSpy = jest.spyOn(performanceMonitor, "endTiming").mockImplementation(() => 0);

    class AsyncDemo {
      async run() {
        await Promise.resolve();
        return "done";
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(AsyncDemo.prototype, "run")!;
    measurePerformance(AsyncDemo.prototype, "run", descriptor);
    Object.defineProperty(AsyncDemo.prototype, "run", descriptor);

    const instance = new AsyncDemo();
    await instance.run();

    expect(startSpy).toHaveBeenCalledWith("AsyncDemo.run");
    expect(endSpy).toHaveBeenCalledWith("AsyncDemo.run");
  });

  it("still ends timing when method throws", () => {
    const startSpy = jest.spyOn(performanceMonitor, "startTiming").mockImplementation(() => {});
    const endSpy = jest.spyOn(performanceMonitor, "endTiming").mockImplementation(() => 0);

    class ThrowingDemo {
      run() {
        throw new Error("failure");
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(ThrowingDemo.prototype, "run")!;
    measurePerformance(ThrowingDemo.prototype, "run", descriptor);
    Object.defineProperty(ThrowingDemo.prototype, "run", descriptor);

    const instance = new ThrowingDemo();
    expect(() => instance.run()).toThrow("failure");
    expect(startSpy).toHaveBeenCalledWith("ThrowingDemo.run");
    expect(endSpy).toHaveBeenCalledWith("ThrowingDemo.run");
  });
});

describe("useMeasureRender", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("starts timing on mount and ends on unmount", () => {
    const startSpy = jest.spyOn(performanceMonitor, "startTiming").mockImplementation(() => {});
    const endSpy = jest.spyOn(performanceMonitor, "endTiming").mockImplementation(() => 0);

    const TestComponent = () => {
      useMeasureRender("Widget");
      return <div>Rendered</div>;
    };

    const result = render(<TestComponent />);
    expect(startSpy).toHaveBeenCalledWith("Widget render");

    act(() => {
      result.unmount();
    });

    expect(endSpy).toHaveBeenCalledWith("Widget render");
  });
});

describe("checkMemoryUsage", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window.performance, "memory");

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window.performance, "memory", originalDescriptor);
    } else {
      delete (window.performance as typeof window.performance & { memory?: unknown }).memory;
    }
  });

  it("returns null when memory information is unavailable", () => {
    delete (window.performance as typeof window.performance & { memory?: unknown }).memory;
    expect(checkMemoryUsage()).toBeNull();
  });

  it("returns rounded memory metrics when available", () => {
    Object.defineProperty(window.performance, "memory", {
      value: {
        usedJSHeapSize: 10 * 1048576,
        totalJSHeapSize: 20 * 1048576,
        jsHeapSizeLimit: 40 * 1048576,
      },
      configurable: true,
    });

    expect(checkMemoryUsage()).toEqual({
      used: 10,
      total: 20,
      limit: 40,
    });
  });
});
