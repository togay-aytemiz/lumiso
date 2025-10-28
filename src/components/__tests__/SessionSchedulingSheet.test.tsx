import { render } from "@testing-library/react";
import { SessionSchedulingSheet } from "../SessionSchedulingSheet";

jest.mock("@/features/session-planning", () => {
  const mock = jest.fn(() => <div data-testid="session-planning-wizard" />);
  return {
    SessionPlanningWizardSheet: mock,
  };
});

const WizardMock = require("@/features/session-planning").SessionPlanningWizardSheet as jest.Mock;

describe("SessionSchedulingSheet", () => {
  beforeEach(() => {
    WizardMock.mockClear();
  });

  it("renders the session planning wizard with derived entry source", () => {
    render(
      <SessionSchedulingSheet
        leadId="lead-1"
        leadName="Taylor"
        projectId="proj-1"
        projectName="Project"
        isOpen
        onOpenChange={jest.fn()}
        onSessionScheduled={jest.fn()}
      />
    );

    expect(WizardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        leadName: "Taylor",
        projectId: "proj-1",
        projectName: "Project",
        entrySource: "project",
        isOpen: true,
      }),
      {}
    );
  });

  it("falls back to lead entry source when no project is provided", () => {
    render(
      <SessionSchedulingSheet
        leadId="lead-2"
        leadName="Alex"
        isOpen={false}
        onOpenChange={jest.fn()}
      />
    );

    expect(WizardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entrySource: "lead",
        isOpen: false,
      }),
      {}
    );
  });

  it("forwards a start step override to the wizard", () => {
    render(
      <SessionSchedulingSheet
        leadId="lead-3"
        leadName="Casey"
        isOpen
        onOpenChange={jest.fn()}
        startStep="schedule"
      />
    );

    expect(WizardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startStepOverride: "schedule",
      }),
      {}
    );
  });
});
