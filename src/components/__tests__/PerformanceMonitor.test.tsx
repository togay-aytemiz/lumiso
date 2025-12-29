import { act, render } from "@testing-library/react";
import { useOnboarding } from "@/contexts/useOnboarding";
import { PerformanceMonitor } from "../PerformanceMonitor";

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(),
}));

describe("PerformanceMonitor", () => {
  const mockUseOnboarding = useOnboarding as jest.MockedFunction<typeof useOnboarding>;
  const originalEnv = process.env.NODE_ENV;
  let originalRAF: typeof window.requestAnimationFrame;
  let originalCancelRAF: typeof window.cancelAnimationFrame;
  type OnboardingMetrics = {
    getRenderCount: () => string | undefined;
    getPerformanceStats: () => Promise<{
      message: string;
      databaseClean: boolean;
      cacheOptimized: boolean;
      consoleSpamRemoved: boolean;
    }>;
  };
  type WindowWithOnboardingMetrics = typeof window & {
    onboardingMetrics?: OnboardingMetrics;
  };
  let onboardingMetrics: OnboardingMetrics | undefined;

  beforeEach(() => {
    mockUseOnboarding.mockReset();
    originalRAF = window.requestAnimationFrame;
    originalCancelRAF = window.cancelAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancelRAF;
    process.env.NODE_ENV = originalEnv;
    delete (window as WindowWithOnboardingMetrics).onboardingMetrics;
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

    onboardingMetrics = (window as WindowWithOnboardingMetrics).onboardingMetrics;
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
