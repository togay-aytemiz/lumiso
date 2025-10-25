import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionStatusBadge } from "../SessionStatusBadge";
import { supabase } from "@/integrations/supabase/client";

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
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

const supabaseFromMock = supabase.from as jest.Mock;

const mockStatusesFetch = (statuses: Array<{ id: string; name: string; color: string }>) => {
  const orderMock = jest.fn(() =>
    Promise.resolve({
      data: statuses,
      error: null,
    })
  );
  const selectMock = jest.fn(() => ({
    order: orderMock,
  }));
  supabaseFromMock.mockReturnValue({
    select: selectMock,
  });
};

describe("SessionStatusBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the current status when not editable", async () => {
    mockStatusesFetch([
      { id: "planned", name: "Planned", color: "#123456" },
    ]);

    render(
      <SessionStatusBadge
        sessionId="session-1"
        currentStatus="planned"
        editable={false}
      />
    );

    expect(await screen.findByText("Planned")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("allows changing status when editable", async () => {
    mockStatusesFetch([
      { id: "planned-id", name: "Planned", color: "#123" },
      { id: "completed-id", name: "Completed", color: "#456" },
    ]);
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

    const completedOption = await screen.findByText("Completed");
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
