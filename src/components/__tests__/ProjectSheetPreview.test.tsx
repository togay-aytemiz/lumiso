import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import ProjectSheetPreview from "../ProjectSheetPreview";
import { useNavigate } from "react-router-dom";
import { useProjectProgress } from "@/hooks/useProjectProgress";
import { useProjectPayments } from "@/hooks/useProjectPayments";
import { supabase } from "@/integrations/supabase/client";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/hooks/useProjectProgress", () => ({
  useProjectProgress: jest.fn(),
}));

jest.mock("@/hooks/useProjectPayments", () => ({
  useProjectPayments: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, any>) => {
      if (options?.channel) {
        return `${key}:${options.channel}`;
      }
      if (options?.count !== undefined) {
        return `${key}:${options.count}`;
      }
      return key;
    },
  }),
}));

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({ isOpen, title, footerActions, children }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="project-sheet-preview">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>
          {footerActions?.map((action: any, index: number) => (
            <button key={index} onClick={() => action.onClick?.()}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
}));

jest.mock("@/components/ProjectStatusBadge", () => ({
  __esModule: true,
  ProjectStatusBadge: ({ onStatusChange }: any) => (
    <button data-testid="project-status-badge" onClick={() => onStatusChange?.()}>
      status-badge
    </button>
  ),
}));

jest.mock("@/components/ClientDetailsCard", () => ({
  __esModule: true,
  default: ({ name }: any) => <div data-testid="client-details">{name}</div>,
}));

const leadsSingleMock = jest.fn();
const projectTypeSingleMock = jest.fn();
const projectStatusMaybeSingleMock = jest
  .fn()
  .mockResolvedValueOnce({ data: { name: "archived" }, error: null })
  .mockResolvedValue({ data: { name: "active" }, error: null });

const createBuilder = ({
  single,
  maybeSingle,
}: {
  single?: jest.Mock;
  maybeSingle?: jest.Mock;
}) => {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: single ?? jest.fn(),
    maybeSingle: maybeSingle ?? jest.fn(),
  };
  return builder;
};

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("ProjectSheetPreview", () => {
  const navigateMock = jest.fn();
  const onOpenChangeMock = jest.fn();
  const onProjectUpdatedMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    leadsSingleMock.mockReset();
    projectTypeSingleMock.mockReset();
    projectStatusMaybeSingleMock
      .mockReset()
      .mockResolvedValueOnce({ data: { name: "archived" }, error: null })
      .mockResolvedValue({ data: { name: "active" }, error: null });

    (useNavigate as jest.Mock).mockReturnValue(navigateMock);

    (useProjectProgress as jest.Mock).mockReturnValue({
      progress: { total: 3, completed: 2, percentage: 67 },
      loading: false,
    });
    (useProjectPayments as jest.Mock).mockReturnValue({
      paymentSummary: {
        totalProject: 1000,
        totalPaid: 600,
        remaining: 400,
      },
      loading: false,
    });

    leadsSingleMock.mockResolvedValue({
      data: {
        id: "lead-1",
        name: "Lead Name",
        email: "lead@example.com",
        phone: "+123",
        status: "active",
        notes: "Important client",
      },
      error: null,
    });

    projectTypeSingleMock.mockResolvedValue({
      data: { id: "type-1", name: "Wedding" },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "leads") {
        return createBuilder({ single: leadsSingleMock });
      }

      if (table === "project_types") {
        return createBuilder({ single: projectTypeSingleMock });
      }

      if (table === "project_statuses") {
        return createBuilder({ maybeSingle: projectStatusMaybeSingleMock });
      }

      return createBuilder({});
    });
  });

  const project = {
    id: "project-1",
    name: "Main Project",
    description: "Important project",
    lead_id: "lead-1",
    user_id: "user-1",
    status_id: "status-1",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-05T00:00:00.000Z",
    project_type_id: "type-1",
  };

  it("renders project overview, metrics, and client details", async () => {
    render(
      <ProjectSheetPreview
        project={project}
        open
        onOpenChange={onOpenChangeMock}
        onProjectUpdated={onProjectUpdatedMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("client-details")).toBeInTheDocument();
    });

    expect(screen.getByTestId("project-sheet-preview")).toBeInTheDocument();
    expect(screen.getAllByText("Main Project").length).toBeGreaterThan(0);
    expect(screen.getByText("forms.project_preview.archived")).toBeInTheDocument();
    expect(projectTypeSingleMock).toHaveBeenCalled();
    expect(screen.getByText("forms.project_preview.progress")).toBeInTheDocument();
    expect(screen.getByText("forms.project_preview.payments")).toBeInTheDocument();
    expect(screen.getByText("Lead Name")).toBeInTheDocument();
  });

  it("navigates to full details and propagates status updates", async () => {
    render(
      <ProjectSheetPreview
        project={project}
        open
        onOpenChange={onOpenChangeMock}
        onProjectUpdated={onProjectUpdatedMock}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "forms.project_preview.view_full_details" })
    );

    expect(navigateMock).toHaveBeenCalledWith("/projects/project-1");
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId("project-status-badge"));

    await waitFor(() => {
      expect(onProjectUpdatedMock).toHaveBeenCalled();
    });
  });
});
