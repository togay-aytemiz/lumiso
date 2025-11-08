import { render, screen, waitFor } from "@/utils/testUtils";
import { ProjectPaymentsSection } from "../ProjectPaymentsSection";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("react-calendar/dist/Calendar.css", () => ({}));

jest.mock("../EditPaymentDialog", () => ({
  EditPaymentDialog: () => null,
}));

type MockSupabaseOptions = {
  project?: Record<string, unknown> | null;
  payments?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
};

const mockUseToast = useToast as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const setupSupabaseFrom = ({
  project = { id: "project-1", base_price: 500 },
  payments = [],
  services = [],
}: MockSupabaseOptions) => {
  const selectProject = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: project, error: null }),
    }),
  });

  const paymentsOrderFinal = jest
    .fn()
    .mockResolvedValue({ data: payments, error: null });
  const paymentsOrder = jest.fn().mockReturnValue({ order: paymentsOrderFinal });
  const selectPayments = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      order: paymentsOrder,
    }),
  });

  const selectServices = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ data: services, error: null }),
  });
  const deleteServices = jest.fn().mockReturnValue({
    in: jest.fn().mockResolvedValue({ error: null }),
  });
  const insertServices = jest.fn().mockResolvedValue({ error: null });
  const updateServices = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  mockSupabaseClient.from.mockImplementation((table: string) => {
    switch (table) {
      case "projects":
        return { select: selectProject };
      case "payments":
        return { select: selectPayments };
      case "project_services":
        return {
          select: selectServices,
          delete: deleteServices,
          insert: insertServices,
          update: updateServices,
        };
      default:
        return { select: jest.fn() };
    }
  });

  return {
    selectProject,
    selectPayments,
    selectServices,
    paymentsOrder,
    paymentsOrderFinal,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseClient.from.mockReset();
  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockUseToast.mockReturnValue({ toast: jest.fn() });
  mockUseFormsTranslation.mockReturnValue({ t: (key: string) => key });
});

describe("ProjectPaymentsSection", () => {
  it("renders summary metrics based on fetched payments and services", async () => {
    const payments = [
      {
        id: "pay-base",
        project_id: "project-1",
        amount: 500,
        description: null,
        status: "due",
        date_paid: null,
        created_at: "2024-05-01T00:00:00Z",
        type: "balance_due",
        deposit_allocation: 0,
      },
      {
        id: "pay-paid",
        project_id: "project-1",
        amount: 200,
        description: "Deposit",
        status: "paid",
        date_paid: "2024-05-02T00:00:00Z",
        created_at: "2024-05-02T00:00:00Z",
        type: "deposit_payment",
        deposit_allocation: 200,
      },
      {
        id: "pay-due",
        project_id: "project-1",
        amount: 100,
        description: "Remaining",
        status: "due",
        date_paid: null,
        created_at: "2024-05-03T00:00:00Z",
        type: "manual",
        deposit_allocation: 0,
      },
    ];

    setupSupabaseFrom({
      project: { id: "project-1", base_price: 500 },
      payments,
      services: [
        {
          id: "ps-1",
          billing_type: "extra",
          quantity: 1,
          unit_price_override: null,
          vat_rate_override: null,
          vat_mode_override: null,
          services: {
            id: "service-1",
            name: "Album",
            selling_price: 150,
            price: 150,
            vat_rate: 18,
            price_includes_vat: true,
            extra: true,
          },
        },
      ],
    });

    render(<ProjectPaymentsSection projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText("payments.summary.collected")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/₺/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("payments.summary.remaining").length).toBeGreaterThan(0);
    expect(screen.getByText("Album")).toBeInTheDocument();
  });

  it("shows empty state when project has no payments and no base price", async () => {
    setupSupabaseFrom({
      project: { id: "project-1", base_price: 0 },
      payments: [],
      services: [],
    });

    render(<ProjectPaymentsSection projectId="project-1" />);

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("payments");
    });

    expect(screen.getByText("payments.no_records")).toBeInTheDocument();
  });

  it("renders quick action buttons with proper availability", async () => {
    setupSupabaseFrom({
      project: {
        id: "project-quick",
        base_price: 600,
        deposit_config: { mode: "fixed", value: 200 }
      },
      payments: [],
      services: [],
    });

    render(<ProjectPaymentsSection projectId="project-quick" />);

    await waitFor(() => {
      expect(screen.getByText("payments.actions.deposit_quick")).toBeInTheDocument();
    });

    expect(screen.getByText("payments.actions.deposit_quick")).toBeEnabled();
    expect(screen.getByText("payments.add_payment")).toBeEnabled();
    expect(screen.getByText("payments.actions.refund_payment")).toBeDisabled();
  });
});
