import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import SessionTypesSection from "../SessionTypesSection";
import type { SessionType } from "../settings/SessionTypeDialogs";
import { useSessionTypes } from "@/hooks/useOrganizationData";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { useFormsTranslation, useCommonTranslation } from "@/hooks/useTypedTranslation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/hooks/useOrganizationData", () => ({
  useSessionTypes: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationSettings", () => ({
  useOrganizationSettings: jest.fn(),
}));

jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: jest.fn(),
  useCommonTranslation: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: jest.fn(),
  };
});

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseSessionTypes = useSessionTypes as jest.Mock;
const mockUseOrganizationSettings = useOrganizationSettings as jest.Mock;
const mockUseOrganization = useOrganization as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockUseFormsTranslation = useFormsTranslation as jest.Mock;
const mockUseCommonTranslation = useCommonTranslation as jest.Mock;
const mockUseQueryClient = useQueryClient as unknown as jest.Mock;
const mockSupabaseFrom = supabase.from as jest.Mock;

const mockUpdateSettings = jest.fn();
const mockToast = jest.fn();
const mockInvalidateQueries = jest.fn();

const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));

const buildSessionType = (overrides: Partial<SessionType> = {}): SessionType => ({
  id: "type-1",
  organization_id: "org-1",
  user_id: "user-1",
  name: "Signature Session",
  description: "Standard coverage",
  category: "Photography",
  duration_minutes: 90,
  is_active: true,
  sort_order: 1,
  default_add_ons: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  mockUpdateSettings.mockReset();
  mockUpdateSettings.mockResolvedValue({ success: true });
  mockToast.mockReset();
  mockInvalidateQueries.mockReset();
  mockUpdate.mockClear();
  mockDelete.mockClear();
  mockUpdateEq.mockClear();
  mockDeleteEq.mockClear();

  mockUseSessionTypes.mockReturnValue({
    data: [],
    isLoading: false,
  });

  mockUseOrganizationSettings.mockReturnValue({
    settings: { default_session_type_id: null },
    updateSettings: mockUpdateSettings,
  });

  mockUseOrganization.mockReturnValue({
    activeOrganizationId: "org-1",
  });

  mockUseToast.mockReturnValue({
    toast: mockToast,
  });

  mockUseFormsTranslation.mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}(${options.name})` : key,
  });

  mockUseCommonTranslation.mockReturnValue({
    t: (key: string) => key,
  });

  mockUseQueryClient.mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });

  mockSupabaseFrom.mockImplementation(() => ({
    update: mockUpdate,
    delete: mockDelete,
  }));
});

afterEach(() => {
  jest.clearAllMocks();
});

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

describe("SessionTypesSection", () => {
  it("renders empty state when no session types exist", () => {
    render(<SessionTypesSection />);

    expect(screen.getByText("sessionTypes.no_session_types")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sessionTypes.add_first_session_type" })).toBeInTheDocument();
  });

  it("allows setting a default session type", async () => {
    mockUseSessionTypes.mockReturnValue({
      data: [buildSessionType({ id: "type-10" })],
      isLoading: false,
    });

    render(<SessionTypesSection />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "sessionTypes.set_default" })[0]
    );

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ default_session_type_id: "type-10" });
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "success.success",
      description: "sessionTypes.success.default_updated",
    });
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("toggles a session type active state", async () => {
    mockUseSessionTypes.mockReturnValue({
      data: [buildSessionType({ id: "type-20", is_active: true })],
      isLoading: false,
    });

    render(<SessionTypesSection />);

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(mockUpdateEq).toHaveBeenCalledWith("id", "type-20");
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "success.success",
      description: "sessionTypes.success.deactivated",
    });
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("deletes a session type", async () => {
    mockUseSessionTypes.mockReturnValue({
      data: [buildSessionType({ id: "type-30", name: "Mini Session" })],
      isLoading: false,
    });

    render(<SessionTypesSection />);

    const deleteButtons = screen.getAllByRole("button", { name: "sessionTypes.actions.delete" });
    fireEvent.click(deleteButtons[0]);

    fireEvent.click(screen.getByRole("button", { name: "buttons.delete" }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "type-30");
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "success.success",
      description: "sessionTypes.success.deleted",
    });
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });
});
