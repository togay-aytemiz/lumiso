import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { EnhancedProjectDialog } from "../EnhancedProjectDialog";

const toastSpy = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

jest.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { id: "profile-1" } }),
}));

jest.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: () => ({
    currentStep: 3,
    shouldLockNavigation: false,
    completeCurrentStep: jest.fn(),
  }),
}));

jest.mock("@/hooks/useNotificationTriggers", () => ({
  useNotificationTriggers: () => ({
    triggerProjectMilestone: jest.fn(),
  }),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({
    activeOrganization: { id: "org-1" },
  }),
}));

const handleModalCloseMock = jest.fn(() => true);

jest.mock("@/hooks/useModalNavigation", () => ({
  useModalNavigation: jest.fn(() => ({
    showGuard: false,
    message: "",
    handleModalClose: handleModalCloseMock,
    handleDiscardChanges: jest.fn(),
    handleStayOnModal: jest.fn(),
    handleSaveAndExit: jest.fn(),
  })),
}));

jest.mock("@/components/settings/NavigationGuardDialog", () => ({
  NavigationGuardDialog: () => null,
}));

jest.mock("../LeadStatusBadge", () => ({
  LeadStatusBadge: ({ leadId }: { leadId: string }) => (
    <span data-testid={`lead-status-${leadId}`}>status</span>
  ),
}));

jest.mock("../ServicePicker", () => ({
  ServicePicker: ({ onSelectionChange }: any) => (
    <div>
      <button onClick={() => onSelectionChange(["svc-1"])}>select-service</button>
    </div>
  ),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const getUserOrganizationIdMock = jest.fn(async () => "org-1");

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: () => getUserOrganizationIdMock(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const { supabase: mockSupabase } = jest.requireMock("@/integrations/supabase/client");

jest.mock("@/components/ui/app-sheet-modal", () => ({
  AppSheetModal: ({
    title,
    isOpen,
    onOpenChange,
    footerActions = [],
    onDirtyClose,
    dirty,
    children,
  }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="enhanced-project-dialog">
        <h1>{title}</h1>
        <button onClick={() => onDirtyClose?.()} disabled={!dirty}>
          trigger-dirty-close
        </button>
        {children}
        {footerActions.map((action: any, index: number) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button onClick={() => onOpenChange(false)}>close-modal</button>
      </div>
    );
  },
}));

const leadsResponse = [
  { id: "lead-1", name: "Alice", email: null, phone: null, status: "new" },
  { id: "lead-2", name: "Bob", email: null, phone: null, status: "contacted" },
];

const packagesResponse = [
  {
    id: "pkg-1",
    name: "Starter",
    description: "Basic package",
    price: 250,
    applicable_types: ["Wedding"],
    default_add_ons: ["svc-1"],
    is_active: true,
  },
];

const projectTypesResponse = [
  { id: "type-1", name: "Wedding", is_default: true },
  { id: "type-2", name: "Portrait", is_default: false },
];

const servicesResponse = [
  { id: "svc-1", name: "Album", category: "Extras", selling_price: 150 },
];

const createLeadsQuery = () => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    neq: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve({ data: leadsResponse, error: null })),
  };
  return query;
};

const createPackagesQuery = () => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve({ data: packagesResponse, error: null })),
  };
  return query;
};

const createProjectTypesQuery = () => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve({ data: projectTypesResponse, error: null })),
  };
  return query;
};

const createServicesQuery = () => {
  let orderCallCount = 0;
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => {
      orderCallCount += 1;
      if (orderCallCount < 2) {
        return query;
      }
      return Promise.resolve({ data: servicesResponse, error: null });
    }),
  };
  return query;
};

beforeEach(() => {
  jest.clearAllMocks();
  handleModalCloseMock.mockReturnValue(true);
  getUserOrganizationIdMock.mockClear();
  getUserOrganizationIdMock.mockResolvedValue("org-1");

  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockSupabase.rpc.mockResolvedValue({ data: "status-1", error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    switch (table) {
      case "leads":
        return createLeadsQuery();
      case "packages":
        return createPackagesQuery();
      case "project_types":
        return createProjectTypesQuery();
      case "services":
        return createServicesQuery();
      default:
        return {
          select: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn(() => ({ order: jest.fn(() => Promise.resolve({ data: [], error: null })) })) })) })),
        };
    }
  });
});

describe("EnhancedProjectDialog", () => {
  it("loads initial project data when opened", async () => {
    render(<EnhancedProjectDialog />);

    const trigger = screen.getByRole("button", { name: /projectDialog\.addProject/ });
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });

    expect(await screen.findByText("Wedding")).toBeInTheDocument();
    expect(screen.getByText(/placeholders\.select_client_placeholder/)).toBeInTheDocument();
  });

  it("resets all form state after cancelling and reopening", async () => {
    render(<EnhancedProjectDialog />);

    const trigger = screen.getByRole("button", { name: /projectDialog\.addProject/ });
    await userEvent.click(trigger);

    const projectNameInput = await screen.findByLabelText(/projectDialog\.projectName/);
    await userEvent.clear(projectNameInput);
    await userEvent.type(projectNameInput, "New Wedding Project");

    const newLeadRadio = screen.getByLabelText(/buttons\.createNewClient/) as HTMLInputElement;
    await userEvent.click(newLeadRadio);
    expect(newLeadRadio.checked).toBe(true);

    const newLeadName = screen.getByLabelText(/projectDialog\.name/);
    await userEvent.type(newLeadName, "Jordan Client");

    const customSetupButton = await screen.findByRole("button", { name: /projectDialog\.setCustomDetails/ });
    await userEvent.click(customSetupButton);

    const basePriceInput = await screen.findByLabelText(/projectDialog\.basePrice/);
    await userEvent.clear(basePriceInput);
    await userEvent.type(basePriceInput, "500");

    const cancelButton = screen.getByRole("button", { name: /buttons\.cancel/ });
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId("enhanced-project-dialog")).not.toBeInTheDocument();
    });

    await userEvent.click(trigger);

    const resetProjectName = await screen.findByLabelText(/projectDialog\.projectName/);
    expect((resetProjectName as HTMLInputElement).value).toBe("");

    const newLeadRadioReset = screen.getByLabelText(/buttons\.createNewClient/) as HTMLInputElement;
    expect(newLeadRadioReset.checked).toBe(false);

    expect(screen.queryByLabelText(/projectDialog\.name/)).not.toBeInTheDocument();

    expect(screen.queryByLabelText(/projectDialog\.basePrice/)).not.toBeInTheDocument();
  });
});
