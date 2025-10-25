import { render, screen, waitFor, fireEvent } from "@/utils/testUtils";
import { ProjectServicesSection } from "@/components/ProjectServicesSection";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    },
    rpc: jest.fn()
  }
}));

const toastSuccess = jest.fn();

jest.mock("@/lib/toastHelpers", () => ({
  useI18nToast: () => ({
    success: toastSuccess,
    error: jest.fn()
  })
}));

const translations: Record<string, string> = {
  "services.title": "Services",
  "services.add": "Add services",
  "services.edit": "Edit services",
  "services.selected_services": "Selected services",
  "services.services_updated": "Services updated",
  "services.cost": "Cost",
  "services.selling": "Selling",
  "projectDetails.services.emptyState": "No services yet",
  "projectDetails.services.addHint": "Add services to get started",
  "buttons.clearAll": "Clear All",
  "common:actions.saving": "Saving",
  "common:buttons.save": "Save",
  "common:buttons.cancel": "Cancel"
};

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string) => translations[key] ?? key
  })
}));

jest.mock("@/components/ServicePicker", () => ({
  ServicePicker: ({ value, onChange, isLoading, error, onRetry }: any) => (
    <div data-testid="service-picker">
      <div data-testid="service-picker-value">{value.join(",")}</div>
      {isLoading && <span>Loading services…</span>}
      {error && (
        <>
          <span>{error}</span>
          <button onClick={onRetry}>Retry</button>
        </>
      )}
      <button onClick={() => onChange(["svc-2"]) }>Choose second</button>
    </div>
  )
}));

const mockProjectServices = [
  {
    services: {
      id: "svc-1",
      name: "Portrait Session",
      category: "Photography",
      cost_price: 50,
      selling_price: 150
    }
  }
];

const availableServices = [
  {
    id: "svc-1",
    name: "Portrait Session",
    category: "Photography",
    cost_price: 50,
    selling_price: 150
  },
  {
    id: "svc-2",
    name: "Wedding Package",
    category: "Photography",
    cost_price: 200,
    selling_price: 450
  }
];

const insertSpy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: "user-1" } }
  });

  (supabase.rpc as jest.Mock).mockResolvedValue({ data: "org-1" });

  insertSpy.mockResolvedValue({ error: null });

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === "project_services") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: mockProjectServices, error: null })
        })),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error: null })
        })),
        insert: insertSpy
      };
    }

    if (table === "services") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn().mockResolvedValue({ data: availableServices, error: null })
            }))
          }))
        }))
      };
    }

    return {};
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function renderComponent(onServicesUpdated?: jest.Mock) {
  return render(
    <ProjectServicesSection projectId="project-1" onServicesUpdated={onServicesUpdated} />
  );
}

test("renders fetched services and toggles edit mode", async () => {
  renderComponent();

  expect(await screen.findByText("Portrait Session")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit services" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Edit services" }));

  expect(await screen.findByTestId("service-picker")).toBeInTheDocument();
  expect(screen.getByTestId("service-picker-value").textContent).toBe("svc-1");

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByTestId("service-picker")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Edit services" })).toBeInTheDocument();
});

test("saves updated services and shows success toast", async () => {
  const updatedCallback = jest.fn();

  renderComponent(updatedCallback);

  await screen.findByText("Portrait Session");

  fireEvent.click(screen.getByRole("button", { name: "Edit services" }));
  const saveButton = await screen.findByRole("button", { name: "Save" });

  fireEvent.click(screen.getByText("Choose second"));

  fireEvent.click(saveButton);

  await waitFor(() => {
    expect(insertSpy).toHaveBeenCalledWith([
      {
        project_id: "project-1",
        service_id: "svc-2",
        user_id: "user-1"
      }
    ]);
  });

  await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Services updated"));
  expect(updatedCallback).toHaveBeenCalled();

  await waitFor(() => expect(screen.queryByTestId("service-picker")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Edit services" })).toBeInTheDocument();
});
