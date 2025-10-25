import { act } from "react";
import { render, screen } from "@/utils/testUtils";
import Index from "../Index";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

jest.mock("@/integrations/supabase/client", () => {
  const onAuthStateChange = jest.fn();
  const getSession = jest.fn();
  return {
    supabase: {
      auth: {
        onAuthStateChange,
        getSession,
      },
    },
  };
});

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("@/components/CrmDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="crm-dashboard" />,
}));

jest.mock("@/components/ui/loading-presets", () => ({
  PageLoadingSkeleton: () => <div data-testid="page-loading" />,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseNavigate = useNavigate as jest.Mock;
const mockAuth = supabase.auth as unknown as {
  onAuthStateChange: jest.Mock;
  getSession: jest.Mock;
};

describe("Index page", () => {
  const navigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigate.mockReturnValue(navigate);
  });

  it("shows loading skeleton while session is resolving", async () => {
    let resolveSession: (value: any) => void = () => {};
    mockAuth.onAuthStateChange.mockImplementation((_handler: any) => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    mockAuth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );

    render(<Index />);

    expect(screen.getByTestId("page-loading")).toBeInTheDocument();

    await act(async () => {
      resolveSession({ data: { session: null } });
    });
  });

  it("renders dashboard when a user session exists", async () => {
    mockAuth.onAuthStateChange.mockImplementation((_handler: any) => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    render(<Index />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("crm-dashboard")).toBeInTheDocument();
  });

  it("renders marketing hero and navigates to auth when CTA clicked", async () => {
    mockAuth.onAuthStateChange.mockImplementation((handler: any) => {
      handler("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    render(<Index />);

    await act(async () => {
      await Promise.resolve();
    });

    const cta = screen.getByRole("button", { name: "buttons.get_started" });
    cta.click();

    expect(navigate).toHaveBeenCalledWith("/auth");
  });
});
