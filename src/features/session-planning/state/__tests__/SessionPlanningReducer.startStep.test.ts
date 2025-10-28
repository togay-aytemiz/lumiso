import { __testUtils } from "../sessionPlanningReducer";
import type { SessionPlanningEntryContext } from "../../types";

const { computeInitialStep } = __testUtils;

describe("sessionPlanningReducer start step handling", () => {
  const baseContext: SessionPlanningEntryContext = {};

  it("defaults to summary for edit sessions", () => {
    expect(
      computeInitialStep({
        ...baseContext,
        mode: "edit",
        sessionId: "session-1",
      })
    ).toBe("summary");
  });

  it("respects provided start step override", () => {
    expect(
      computeInitialStep({
        ...baseContext,
        startStepOverride: "schedule",
      })
    ).toBe("schedule");
  });

  it("falls back to project step when lead + project context provided", () => {
    expect(
      computeInitialStep({
        ...baseContext,
        leadId: "lead-1",
        projectId: "project-1",
      })
    ).toBe("sessionType");
  });
});
