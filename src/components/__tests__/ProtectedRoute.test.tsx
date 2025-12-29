import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "../ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOnboarding } from "@/contexts/useOnboarding";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/contexts/useOnboarding", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@lottiefiles/dotlottie-react", () => ({
  __esModule: true,
  DotLottieReact: () => <div data-testid="dotlottie" />,
}));

jest.mock("../AppLoadingScreen", () => ({
  __esModule: true,
  AppLoadingScreen: ({ message }: { message?: string }) => (
    <div data-testid="app-loading">{message}</div>
  ),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../Layout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseOrganization = useOrganization as jest.MockedFunction<
  typeof useOrganization
>;
const mockUseOnboarding = useOnboarding as jest.MockedFunction<
  typeof useOnboarding
>;

function renderWithRouter(initialEntry = "/projects") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<div data-testid="auth-page" />} />
        <Route
          path="/getting-started"
          element={<div data-testid="getting-started" />}
        />
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div data-testid="protected" />} />
          <Route
            path="/projects/*"
            element={<div data-testid="protected-nested" />}
          />
        <Route
          path="/settings/profile"
          element={<div data-testid="profile" />}
        />
          <Route path="/dashboard" element={<div data-testid="dashboard" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUseOrganization.mockReturnValue({
      activeOrganization: null,
      loading: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading indicator while auth or onboarding data loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    mockUseOnboarding.mockReturnValue({
      shouldLockNavigation: false,
      loading: false,
    });

    renderWithRouter();

    expect(screen.getByText("actions.loading")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to auth route", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockUseOnboarding.mockReturnValue({
      shouldLockNavigation: false,
      loading: false,
    });

    renderWithRouter();

    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });

  it("locks navigation during onboarding and redirects to getting-started", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockUseOnboarding.mockReturnValue({
      shouldLockNavigation: true,
      loading: false,
    });

    renderWithRouter("/dashboard");

    expect(screen.getByTestId("getting-started")).toBeInTheDocument();
  });

  it("renders layout and outlet content when access allowed", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockUseOnboarding.mockReturnValue({
      shouldLockNavigation: false,
      loading: false,
    });

    renderWithRouter("/projects");

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("allows onboarding pages when in guided setup", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockUseOnboarding.mockReturnValue({
      shouldLockNavigation: true,
      loading: false,
    });

    renderWithRouter("/settings/profile");

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("profile")).toBeInTheDocument();
  });
});
