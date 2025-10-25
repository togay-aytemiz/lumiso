import React from "react";
import { act, render } from "@testing-library/react";
import { useOnboarding } from "@/contexts/OnboardingContext";

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: jest.fn(),
}));

describe("PerformanceMonitor", () => {
  const mockUseOnboarding = useOnboarding as jest.MockedFunction<typeof useOnboarding>;
  const originalEnv = process.env.NODE_ENV;
  let originalRAF: typeof window.requestAnimationFrame;
  let originalCancelRAF: typeof window.cancelAnimationFrame;
  let PerformanceMonitor: React.ComponentType;
  let onboardingMetrics: any;

  beforeAll(() => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require("../PerformanceMonitor");
    PerformanceMonitor = module.PerformanceMonitor;
    onboardingMetrics = (window as any).onboardingMetrics;
    process.env.NODE_ENV = previousEnv;
  });

  beforeEach(() => {
    mockUseOnboarding.mockReset();
    originalRAF = window.requestAnimationFrame;
    originalCancelRAF = window.cancelAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancelRAF;
    process.env.NODE_ENV = originalEnv;
  });

  it("returns null outside development mode", () => {
    process.env.NODE_ENV = "test";
    mockUseOnboarding.mockReturnValue({
      stage: "intro",
      currentStep: 0,
      loading: false,
    });

    const { container } = render(<PerformanceMonitor />);
    expect(container.firstChild).toBeNull();
  });

  it("warns when rerender threshold exceeded in development", async () => {
    process.env.NODE_ENV = "development";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    let callIndex = 0;
    mockUseOnboarding.mockImplementation(() => ({
      stage: "setup",
      currentStep: callIndex++,
      loading: false,
    }));

    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1 as unknown as number;
    };
    window.cancelAnimationFrame = jest.fn();

    const { rerender } = render(<PerformanceMonitor />);

    for (let i = 0; i < 105; i += 1) {
      await act(async () => {
        rerender(<PerformanceMonitor />);
      });
    }

    expect(warnSpy).toHaveBeenCalledWith(
      "PerformanceMonitor: High onboarding re-render count detected:",
      expect.objectContaining({
        renderCount: expect.any(Number),
        stage: "setup",
        currentStep: expect.any(Number),
        loading: false,
        timestamp: expect.any(String),
      })
    );

    expect(onboardingMetrics).toBeDefined();
    await expect(onboardingMetrics?.getPerformanceStats()).resolves.toEqual({
      message: "V3 Onboarding System - Production Ready",
      databaseClean: true,
      cacheOptimized: true,
      consoleSpamRemoved: true,
    });

    warnSpy.mockRestore();
  });
});
