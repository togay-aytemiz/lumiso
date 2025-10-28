import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SessionPlanningWizardSheet } from "../SessionPlanningWizardSheet";
import { useSessionPlanningContext } from "../../hooks/useSessionPlanningContext";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/features/session-planning/context/SessionSavedResourcesProvider", () => ({
  SessionSavedResourcesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/features/session-planning/context/SessionWorkflowProvider", () => ({
  SessionWorkflowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSessionWorkflowCatalog: () => ({
    reminderWorkflows: [],
    summaryEmailWorkflows: [],
    otherWorkflows: [],
  }),
}));

jest.mock("@/lib/telemetry", () => ({
  trackEvent: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
}));

type SupabaseBuilder = {
  select: jest.Mock<SupabaseBuilder, [string?]>;
  eq: jest.Mock<SupabaseBuilder, [string, unknown]>;
  limit: jest.Mock<SupabaseBuilder, [number]>;
  maybeSingle: jest.Mock<Promise<any>, []>;
  single: jest.Mock<Promise<any>, []>;
  order: jest.Mock<SupabaseBuilder, [string, { ascending?: boolean }?]>;
};

function createBuilder() {
  const builder: Partial<SupabaseBuilder> = {};
  const chain = () => builder as SupabaseBuilder;
  builder.select = jest.fn(() => chain());
  builder.eq = jest.fn(() => chain());
  builder.limit = jest.fn(() => chain());
  builder.order = jest.fn(() => chain());
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve({ data: null, error: null, status: 200, statusText: "OK" })
  );
  builder.single = jest.fn(() =>
    Promise.resolve({ data: null, error: null, status: 200, statusText: "OK" })
  );
  return builder as SupabaseBuilder;
}

function createSupabaseStub() {
  let sessionResponse = { data: null, error: null, status: 200, statusText: "OK" };
  const sessionBuilder = createBuilder();
  sessionBuilder.maybeSingle = jest.fn(() => Promise.resolve(sessionResponse));
  sessionBuilder.single = jest.fn(() => Promise.resolve(sessionResponse));
  const builders = new Map<string, SupabaseBuilder>();
  const getBuilder = (table: string) => {
    if (table === "sessions") {
      return sessionBuilder;
    }
    if (!builders.has(table)) {
      builders.set(table, createBuilder());
    }
    return builders.get(table)!;
  };

  const supabase = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: "wizard-user" } }, error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn((table: string) => getBuilder(table)),
    rpc: jest.fn(),
  };

  return {
    supabase,
    setSessionResponse: (response: any) => {
      sessionResponse = {
        status: 200,
        statusText: "OK",
        error: null,
        ...response,
      };
    },
    reset: () => {
      sessionResponse = { data: null, error: null, status: 200, statusText: "OK" };
      sessionBuilder.select.mockClear();
      sessionBuilder.eq.mockClear();
      sessionBuilder.limit.mockClear();
      sessionBuilder.order.mockClear();
      sessionBuilder.maybeSingle.mockClear();
      sessionBuilder.single.mockClear();
      builders.forEach((builder) => {
        builder.select.mockClear();
        builder.eq.mockClear();
        builder.limit.mockClear();
        builder.order.mockClear();
        builder.maybeSingle.mockClear();
        builder.single.mockClear();
      });
      builders.clear();
      supabase.auth.getUser.mockClear();
      supabase.auth.onAuthStateChange.mockClear();
      supabase.from.mockClear();
      supabase.rpc.mockClear();
    },
  };
}

jest.mock("@/integrations/supabase/client", () => {
  const stub = createSupabaseStub();
  return {
    supabase: stub.supabase,
    __supabaseTestStub: stub,
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

const getSupabaseStub = () =>
  (jest.requireMock("@/integrations/supabase/client") as unknown as {
    __supabaseTestStub: ReturnType<typeof createSupabaseStub>;
  }).__supabaseTestStub;

describe("SessionPlanningWizardSheet start step behaviour", () => {
  beforeEach(() => {
    getSupabaseStub().reset();
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

  it("defaults edit sessions to summary when no override provided", async () => {
    const stub = getSupabaseStub();
    stub.setSessionResponse({
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
    });

    render(
      <SessionPlanningWizardSheet
        isOpen={false}
        onOpenChange={jest.fn()}
        mode="edit"
        sessionId="session-1"
      />
    );

    expect(await screen.findByTestId("wizard-step")).toHaveTextContent("summary");
  });

  it("honours edit mode start step override", async () => {
    const stub = getSupabaseStub();
    stub.setSessionResponse({
      data: {
        id: "session-2",
        session_date: "2024-07-01",
        session_time: "08:30",
        lead_id: "lead-7",
        leads: { id: "lead-7", name: "Morgan" },
        session_types: { id: "type-2", name: "Mini" },
      },
    });

    render(
      <SessionPlanningWizardSheet
        isOpen={false}
        onOpenChange={jest.fn()}
        mode="edit"
        sessionId="session-2"
        startStepOverride="schedule"
      />
    );

    expect(await screen.findByTestId("wizard-step")).toHaveTextContent("schedule");
  });
});
