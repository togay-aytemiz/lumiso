import { render, screen, waitFor, fireEvent } from "@/utils/testUtils";
import { ProjectPaymentsSection } from "../ProjectPaymentsSection";
import { mockSupabaseClient } from "@/utils/testUtils";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
}));

jest.mock("../AddPaymentDialog", () => ({
  AddPaymentDialog: ({ onPaymentAdded }: { onPaymentAdded?: () => void }) => (
    <button onClick={() => onPaymentAdded?.()} aria-label="trigger-add-payment">
      add payment
    </button>
  ),
}));

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

  mockSupabaseClient.from.mockImplementation((table: string) => {
    switch (table) {
      case "projects":
        return { select: selectProject };
      case "payments":
        return { select: selectPayments };
      case "project_services":
        return { select: selectServices };
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
        type: "base_price",
      },
      {
        id: "pay-paid",
        project_id: "project-1",
        amount: 200,
        description: "Deposit",
        status: "paid",
        date_paid: "2024-05-02T00:00:00Z",
        created_at: "2024-05-02T00:00:00Z",
        type: "manual",
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
      },
    ];

    setupSupabaseFrom({
      project: { id: "project-1", base_price: 500 },
      payments,
      services: [
        {
          services: {
            id: "service-1",
            name: "Album",
            selling_price: 150,
            extra: true,
          },
        },
      ],
    });

    render(<ProjectPaymentsSection projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText("payments.total_paid")).toBeInTheDocument();
    });

    expect(screen.getAllByText("TRY 200").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TRY 150").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TRY 550").length).toBeGreaterThan(0);
    expect(screen.getAllByText("payments.due").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deposit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("payments.base_price_label").length).toBeGreaterThan(0);
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

    expect(screen.getByText("payments.no_payments")).toBeInTheDocument();
  });

  it("refreshes payments and notifies parent when a new payment is added", async () => {
    const onPaymentsUpdated = jest.fn();
    const payments = [
      {
        id: "pay-base",
        project_id: "project-1",
        amount: 500,
        description: null,
        status: "due",
        date_paid: null,
        created_at: "2024-05-01T00:00:00Z",
        type: "base_price",
      },
    ];

    setupSupabaseFrom({
      project: { id: "project-1", base_price: 500 },
      payments,
      services: [],
    });

    render(<ProjectPaymentsSection projectId="project-1" onPaymentsUpdated={onPaymentsUpdated} />);

    await waitFor(() => {
      expect(screen.getByLabelText("trigger-add-payment")).toBeInTheDocument();
    });

    mockSupabaseClient.from.mockClear();
    setupSupabaseFrom({
      project: { id: "project-1", base_price: 500 },
      payments,
      services: [],
    });

    fireEvent.click(screen.getByLabelText("trigger-add-payment"));

    await waitFor(() => {
      expect(onPaymentsUpdated).toHaveBeenCalled();
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith("payments");
  });
});
