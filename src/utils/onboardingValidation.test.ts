import {
  validateOnboardingSystem,
  validateStageTransition,
  getSystemHealthStatus,
} from "./onboardingValidation";

describe("validateOnboardingSystem", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns healthy status when onboarding configuration is consistent", () => {
    const result = validateOnboardingSystem();

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.summary.systemHealth).toBe("healthy");
    expect(result.summary.totalSteps).toBe(result.summary.validSteps);
  });

  it("flags mismatched step metadata and totals", async () => {
    jest.doMock("@/constants/onboarding", () => ({
      ONBOARDING_STEPS: [
        {
          id: 3,
          title: "  ",
          description: "Broken config",
          route: "",
          buttonText: "",
          duration: "0 min",
        },
        {
          id: 1,
          title: "Valid title",
          description: "Missing button",
          route: "/valid",
          buttonText: "",
          duration: "1 min",
        },
      ],
      TOTAL_STEPS: 5,
    }));

    const { validateOnboardingSystem: runValidation } = await import("./onboardingValidation");
    const result = runValidation();

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      "Step 0 has incorrect ID: expected 1, got 3",
      "Step 3 missing title",
      "Step 3 missing route",
      "Step 1 has incorrect ID: expected 2, got 1",
      "TOTAL_STEPS (5) doesn't match ONBOARDING_STEPS length (2)",
    ]);
    expect(result.warnings).toEqual([
      "Step 3 missing button text",
      "Step 1 missing button text",
    ]);
    expect(result.summary.systemHealth).toBe("error");
    expect(result.summary.validSteps).toBe(0);
  });
});

describe("validateStageTransition", () => {
  it("permits configured forward transitions", () => {
    expect(validateStageTransition("not_started", "modal_shown")).toBe(true);
    expect(validateStageTransition("modal_shown", "in_progress")).toBe(true);
    expect(validateStageTransition("in_progress", "completed")).toBe(true);
    expect(validateStageTransition("skipped", "in_progress")).toBe(true);
  });

  it("rejects invalid or terminal transitions", () => {
    expect(validateStageTransition("completed", "in_progress")).toBe(false);
    expect(validateStageTransition("modal_shown", "completed")).toBe(false);
    expect(validateStageTransition("not_started", "completed")).toBe(false);
  });
});

describe("getSystemHealthStatus", () => {
  it("derives health status and metrics from onboarding validation", async () => {
    jest.doMock("@/constants/onboarding", () => ({
      ONBOARDING_STEPS: [
        {
          id: 2,
          title: "Misnumbered Step",
          description: "Broken data",
          route: "",
          buttonText: "",
          duration: "1 min",
        },
      ],
      TOTAL_STEPS: 3,
    }));

    const moduleRef = await import("./onboardingValidation");
    const health = moduleRef.getSystemHealthStatus();

    expect(health.status).toBe("error");
    expect(health.version).toBe("V3");
    expect(health.features.productionReady).toBe(false);
    expect(health.metrics).toEqual({
      totalSteps: 3,
      validSteps: 0,
      errorCount: 3,
      warningCount: 1,
    });
  });
});
