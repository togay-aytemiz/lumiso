import { renderHook, act } from "@testing-library/react";
import { OnboardingProvider, useOnboarding } from "../OnboardingContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ONBOARDING_STEPS, TOTAL_STEPS } from "@/constants/onboarding";

jest.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: jest.fn(),
}));

const mockUseUserPreferences = useUserPreferences as jest.MockedFunction<
  typeof useUserPreferences
>;

const basePreferences = {
  userId: "user-1",
  activeOrganizationId: "org-1",
  onboardingStage: "not_started" as const,
  currentOnboardingStep: 1,
  welcomeModalShown: false,
  organizationId: "org-1",
  businessName: "Business",
  logoUrl: null,
  primaryBrandColor: "#1EB29F",
  timezone: "UTC",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12-hour",
  displayName: null,
  avatarUrl: null,
  lastUpdated: new Date().toISOString(),
};

const createWrapper =
  () =>
  ({ children }: { children: React.ReactNode }) =>
    <OnboardingProvider>{children}</OnboardingProvider>;

describe("OnboardingContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("provides default values while loading preferences", () => {
    mockUseUserPreferences.mockReturnValue({
      data: undefined,
      isLoading: true,
      updatePreferences: jest.fn(),
    } as any);

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.shouldShowWelcomeModal).toBe(false);
    expect(result.current.completedSteps).toEqual([]);
  });

  it("computes onboarding state and supports guided setup start", async () => {
    const updatePreferences = jest.fn(() => Promise.resolve());
    mockUseUserPreferences.mockReturnValue({
      data: basePreferences,
      isLoading: false,
      updatePreferences,
    } as any);

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    expect(result.current.shouldShowWelcomeModal).toBe(true);
    expect(result.current.isInGuidedSetup).toBe(false);

    await act(async () => {
      await result.current.startGuidedSetup();
    });

    expect(updatePreferences).toHaveBeenCalledWith({
      onboardingStage: "in_progress",
      currentOnboardingStep: 1,
      welcomeModalShown: true,
    });
  });

  it("handles step progression and completion guards", async () => {
    const updatePreferences = jest.fn(() => Promise.resolve());
    mockUseUserPreferences.mockReturnValue({
      data: { ...basePreferences, onboardingStage: "in_progress", currentOnboardingStep: 2, welcomeModalShown: true },
      isLoading: false,
      updatePreferences,
    } as any);

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    expect(result.current.completedSteps).toEqual(ONBOARDING_STEPS.slice(0, 1));
    expect(result.current.currentStepInfo?.id).toBe(2);
    expect(result.current.nextStepInfo?.id).toBe(3);

    await act(async () => {
      await result.current.completeCurrentStep();
    });

    expect(updatePreferences).toHaveBeenCalledWith({
      currentOnboardingStep: 3,
    });

    await act(async () => {
      await result.current.completeMultipleSteps(10);
    });

    expect(updatePreferences).toHaveBeenLastCalledWith({
      currentOnboardingStep: TOTAL_STEPS + 1,
    });
  });

  it("supports completion, skipping, and reset flows", async () => {
    const updatePreferences = jest.fn(() => Promise.resolve());
    mockUseUserPreferences.mockReturnValue({
      data: { ...basePreferences, onboardingStage: "in_progress", currentOnboardingStep: TOTAL_STEPS, welcomeModalShown: true },
      isLoading: false,
      updatePreferences,
    } as any);

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });
    await act(async () => {
      await result.current.skipOnboarding();
    });
    await act(async () => {
      await result.current.resetOnboarding();
    });

    expect(updatePreferences).toHaveBeenNthCalledWith(1, {
      onboardingStage: "completed",
      currentOnboardingStep: TOTAL_STEPS + 1,
    });
    expect(updatePreferences).toHaveBeenNthCalledWith(2, {
      onboardingStage: "skipped",
    });
    expect(updatePreferences).toHaveBeenNthCalledWith(3, {
      onboardingStage: "in_progress",
      currentOnboardingStep: 1,
      welcomeModalShown: true,
    });
  });

  it("throws when hook used outside provider", () => {
    expect(() => renderHook(() => useOnboarding())).toThrow(
      "useOnboarding must be used within an OnboardingProvider"
    );
  });
});
