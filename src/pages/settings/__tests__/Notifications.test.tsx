import React from "react";
import { fireEvent, render, screen, waitFor } from "@/utils/testUtils";
import Notifications from "../Notifications";
import { mockSupabaseClient } from "@/utils/testUtils";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));

jest.mock("@/components/settings/SettingsPageWrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-wrapper">{children}</div>
  ),
}));

jest.mock("@/components/settings/SettingsHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock("@/components/settings/CategorySettingsSection", () => ({
  CategorySettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  __esModule: true,
  Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    )
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value, disabled }: { children: React.ReactNode; onValueChange?: (value: string) => void; value: string; disabled?: boolean }) => (
    <select
      data-testid="notification-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled, id }: { checked: boolean; onCheckedChange?: (value: boolean) => void; disabled?: boolean; id: string }) => (
    <button
      data-testid={`switch-${id}`}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

jest.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

jest.mock("@/components/ui/loading-presets", () => ({
  SettingsLoadingSkeleton: () => <div>loading</div>,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const supabaseMock = mockSupabaseClient as unknown as {
  from: jest.Mock;
  auth: { getUser: jest.Mock };
  functions: { invoke: jest.Mock };
};

const createFromMock = () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn(),
    maybeSingle: jest.fn(),
    order: jest.fn().mockReturnThis(),
  };
  return chain as {
    select: jest.Mock;
    eq: jest.Mock;
    update: jest.Mock;
    maybeSingle: jest.Mock;
    order: jest.Mock;
  };
};

describe("Notifications settings page", () => {
  beforeEach(() => {
    supabaseMock.auth.getUser = jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

    supabaseMock.from = jest.fn((table: string) => {
      const chain = createFromMock();

      if (table === "user_settings") {
        chain.maybeSingle.mockResolvedValue({
          data: {
            notification_global_enabled: true,
            notification_scheduled_time: "10:30",
            notification_daily_summary_enabled: false,
            notification_project_milestone_enabled: true,
          },
        });
        chain.update.mockImplementation(() => ({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }));
      }

      return chain;
    });

    supabaseMock.functions = {
      invoke: jest.fn().mockResolvedValue({ data: { success: true } }),
    } as { invoke: jest.Mock };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("loads user settings on mount", async () => {
    render(<Notifications />);

    await waitFor(() => {
      expect(supabaseMock.from).toHaveBeenCalledWith("user_settings");
    });

    expect(screen.getByTestId("switch-global-notifications")).toHaveTextContent("on");
  });

  it("updates all notification toggles when master switch is clicked", async () => {
    render(<Notifications />);

    const masterSwitch = await screen.findByTestId("switch-global-notifications");
    fireEvent.click(masterSwitch);

    await waitFor(() => {
      const updateResult = (supabaseMock.from as jest.Mock).mock.results
        .map((result) => result.value)
        .find((value: { update?: { mock?: { calls?: unknown[] } } }) => value?.update?.mock?.calls?.length);

      expect(updateResult?.update).toHaveBeenCalledWith({
        notification_global_enabled: false,
        notification_daily_summary_enabled: false,
        notification_project_milestone_enabled: false,
      });
    });
  });

  it("invokes the notification test function when test button is pressed", async () => {
    render(<Notifications />);

    const [firstTestButton] = await screen.findAllByText("settings.notifications.sendTest");
    fireEvent.click(firstTestButton);

    await waitFor(() => {
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
        "send-reminder-notifications",
        expect.objectContaining({
          body: expect.objectContaining({ type: "daily-summary" }),
        })
      );
    });
  });
});
