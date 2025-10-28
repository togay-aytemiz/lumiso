import { render, screen } from "@testing-library/react";
import React from "react";
import { SessionPlanningWizardSheet } from "../SessionPlanningWizardSheet";
import { useSessionPlanningContext } from "../../hooks/useSessionPlanningContext";
import type { SupabaseMockController } from "@/tests/mocks/createSupabaseClientMock";
import { createQueryBuilderMock } from "@/tests/mocks/createSupabaseClientMock";

jest.mock("@/integrations/supabase/client", () => {
  const controller = require("@/tests/mocks/createSupabaseClientMock").createSupabaseClientMock();
  return {
    supabase: controller.supabase,
    __supabaseMock: controller,
  };
});

jest.mock("../SessionPlanningWizard", () => {
  const React = require("react");
  const { useSessionPlanningContext } = require("../../hooks/useSessionPlanningContext");
  return {
    SessionPlanningWizard: jest.fn(() => {
      const { state } = useSessionPlanningContext();
      return <div data-testid="wizard-step">{state.meta.currentStep}</div>;
    }),
  };
});

describe("SessionPlanningWizardSheet start step handling", () => {
  const getController = () =>
    (jest.requireMock("@/integrations/supabase/client") as { __supabaseMock: SupabaseMockController })
      .__supabaseMock;

  beforeEach(() => {
    const controller = getController();
    controller.reset();
    localStorage.clear();
  });

  it("respects start step override for create flow", async () => {
    render(
      <SessionPlanningWizardSheet
        isOpen={false}
        onOpenChange={jest.fn()}
        leadId="lead-1"
        leadName="Taylor"
        startStepOverride="schedule"
      />
    );

    expect(await screen.findByTestId("wizard-step")).toHaveTextContent("schedule");
  });

  it("defaults edit sessions to summary when no override is provided", async () => {
    const controller = getController();
    const sessionsBuilder = controller.setTableMock("sessions");
    sessionsBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        session_date: "2024-05-10",
        session_time: "10:00",
        session_name: "Planning",
        lead_id: "lead-99",
        leads: { id: "lead-99", name: "Jamie" },
        project_id: "project-42",
        projects: { id: "project-42", name: "Shoot" },
        session_types: { id: "type-1", name: "Standard" },
      },
      error: null,
      status: 200,
      statusText: "OK",
    } as any);

    render(
      <SessionPlanningWizardSheet
        isOpen
        onOpenChange={jest.fn()}
        mode="edit"
        sessionId="session-1"
      />
    );

    expect(await screen.findByTestId("wizard-step")).toHaveTextContent("summary");
  });

  it("overrides edit mode start step when provided", async () => {
    const controller = getController();
    const sessionsBuilder = controller.setTableMock("sessions", createQueryBuilderMock());
    sessionsBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: "session-2",
        session_date: "2024-07-01",
        session_time: "08:30",
        lead_id: "lead-7",
        leads: { id: "lead-7", name: "Morgan" },
        session_types: { id: "type-2", name: "Mini" },
      },
      error: null,
      status: 200,
      statusText: "OK",
    } as any);

    render(
      <SessionPlanningWizardSheet
        isOpen
        onOpenChange={jest.fn()}
        mode="edit"
        sessionId="session-2"
        startStepOverride="schedule"
      />
    );

    expect(await screen.findByTestId("wizard-step")).toHaveTextContent("schedule");
  });
});
