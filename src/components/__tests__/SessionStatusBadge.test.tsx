import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionStatusBadge } from "../SessionStatusBadge";

jest.mock("react-i18next", () => ({
  ...jest.requireActual("react-i18next"),
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      (options as { defaultValue?: string })?.defaultValue ?? _key,
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

const toastMock = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const updateSessionStatusMock = jest.fn();
jest.mock("@/hooks/useSessionActions", () => ({
  useSessionActions: () => ({ updateSessionStatus: updateSessionStatusMock }),
}));

jest.mock("@/hooks/useTypedTranslation", () => ({
  useFormsTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
  }),
  useMessagesTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
  }),
}));

const useSessionStatusesMock = jest.fn();
jest.mock("@/hooks/useOrganizationData", () => ({
  useSessionStatuses: () => useSessionStatusesMock(),
}));

describe("SessionStatusBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the current status when not editable", async () => {
    useSessionStatusesMock.mockReturnValue({
      data: [{ id: "planned-id", template_slug: "planned", name: "Planlandı", color: "#123456" }],
      isLoading: false,
    });

    render(
      <SessionStatusBadge
        sessionId="session-1"
        currentStatus="planned"
        editable={false}
      />
    );

    expect(await screen.findByText("Planlandı")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("allows changing status when editable", async () => {
    useSessionStatusesMock.mockReturnValue({
      data: [
        { id: "planned-id", template_slug: "planned", name: "Planned", color: "#123" },
        { id: "completed-id", template_slug: "completed", name: "Tamamlandı", color: "#456" },
      ],
      isLoading: false,
    });
    updateSessionStatusMock.mockResolvedValue(true);

    render(
      <SessionStatusBadge
        sessionId="session-2"
        currentStatus="planned"
        editable
      />
    );

    const trigger = await screen.findByRole("button", { name: /Planned/i });
    await userEvent.click(trigger);

    const completedOption = await screen.findByText("Tamamlandı");
    fireEvent.click(completedOption);

    await waitFor(() =>
      expect(updateSessionStatusMock).toHaveBeenCalledWith("session-2", "completed")
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("status.sessionUpdated"),
        description: expect.stringContaining("toast.statusSetTo"),
      })
    );
  });
});
