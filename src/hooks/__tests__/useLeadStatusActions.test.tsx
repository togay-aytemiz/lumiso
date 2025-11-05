jest.mock("@/integrations/supabase/client", () => {
  const auth = {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  };

  const rpc = jest.fn();

  const from = jest.fn();

  return {
    __esModule: true,
    supabase: {
      auth,
      rpc,
      from,
      functions: {
        invoke: jest.fn(),
      },
    },
  };
});

const toastMock = jest.fn();

jest.mock("@/hooks/use-toast", () => {
  return {
    __esModule: true,
    useToast: () => ({ toast: toastMock }),
  };
});

jest.mock("@/components/ui/toast", () => ({
  __esModule: true,
  ToastAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => Promise<void> | void;
  }) => React.createElement("button", { onClick }, children),
}));

import React from "react";
import { renderHook, act } from "@testing-library/react";

import { useLeadStatusActions } from "../useLeadStatusActions";
import { supabase } from "@/integrations/supabase/client";

const authMock = supabase.auth.getUser as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;
const fromMock = supabase.from as jest.Mock;

type LeadStatusRecord = { id: string; name: string };
type LeadStatusResponse = { data: LeadStatusRecord | null; error: Error | null };

const leadStatusQueue: LeadStatusResponse[] = [];
const leadStatusesQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockImplementation(() =>
    Promise.resolve(leadStatusQueue.shift() ?? { data: null, error: null })
  ),
};

type LeadsUpdateResult = { error: Error | null };

const leadsUpdateResults: LeadsUpdateResult[] = [];
const leadsQuery = {
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockImplementation((_column: string, _value: string) =>
    Promise.resolve(leadsUpdateResults.shift() ?? { error: null })
  ),
};

beforeEach(() => {
  jest.useRealTimers();

  authMock.mockReset();
  rpcMock.mockReset();
  fromMock.mockReset();
  toastMock.mockReset();

  leadStatusQueue.length = 0;
  leadStatusesQuery.select.mockClear();
  leadStatusesQuery.eq.mockClear();
  leadStatusesQuery.maybeSingle.mockClear();

  leadsUpdateResults.length = 0;
  leadsQuery.update.mockClear();
  leadsQuery.eq.mockClear();

  authMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  rpcMock.mockResolvedValue({ data: null, error: null });

  fromMock.mockImplementation((table: string) => {
    if (table === "lead_statuses") {
      return leadStatusesQuery;
    }
    if (table === "leads") {
      return leadsQuery;
    }
    throw new Error(`Unexpected table ${table}`);
  });
});

describe("useLeadStatusActions", () => {
  it("updates status, triggers callbacks, and supports undo", async () => {
    const onStatusChange = jest.fn();

    leadStatusQueue.push(
      { data: { id: "status-complete", name: "Completed" }, error: null },
      { data: { id: "status-prev", name: "Qualified" }, error: null }
    );

    leadsUpdateResults.push({ error: null }, { error: null });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange })
    );

    await act(async () => {
      await result.current.markAsCompleted("Qualified");
    });

    expect(result.current.isUpdating).toBe(false);
    expect(authMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("ensure_system_lead_statuses", {
      user_uuid: "user-1",
    });
    expect(leadStatusesQuery.select).toHaveBeenCalledWith("id, name");
    expect(leadStatusesQuery.eq).toHaveBeenCalledWith("name", "Completed");
    expect(leadsQuery.update).toHaveBeenCalledWith({
      status_id: "status-complete",
      status: "Completed",
    });
    expect(leadsQuery.eq).toHaveBeenCalledWith("id", "lead-1");
    expect(onStatusChange).toHaveBeenCalledTimes(1);

    const toastArgs = toastMock.mock.calls[0]?.[0];
    expect(toastArgs).toMatchObject({
      title: "Status Updated",
      description: "Lead marked as Completed",
    });
    expect(React.isValidElement(toastArgs.action)).toBe(true);

    await act(async () => {
      await toastArgs.action.props.onClick();
    });

    expect(leadStatusesQuery.eq).toHaveBeenCalledWith("name", "Qualified");
    expect(leadsQuery.update).toHaveBeenLastCalledWith({
      status_id: "status-prev",
      status: "Qualified",
    });

    expect(onStatusChange).toHaveBeenCalledTimes(2);
    const undoToast = toastMock.mock.calls[1]?.[0];
    expect(undoToast).toMatchObject({
      title: "Undone",
      description: "Status reverted to Qualified",
    });
  });

  it("shows destructive toast when user not authenticated", async () => {
    authMock.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn() })
    );

    await act(async () => {
      await result.current.markAsCompleted();
    });

    const toastArgs = toastMock.mock.calls[0]?.[0];
    expect(toastArgs).toMatchObject({
      title: "Error updating status",
      variant: "destructive",
    });
    expect(result.current.isUpdating).toBe(false);
  });

  it("surfaces errors from status lookup", async () => {
    leadStatusQueue.push({ data: null, error: new Error("status lookup failed") });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn() })
    );

    await act(async () => {
      await result.current.markAsCompleted();
    });

    const toastArgs = toastMock.mock.calls[0]?.[0];
    expect(toastArgs).toMatchObject({
      title: "Error updating status",
      description: "status lookup failed",
      variant: "destructive",
    });
  });

  it("supports custom labels for lost status without undo", async () => {
    leadStatusQueue.push({ data: { id: "status-archived", name: "Archived" }, error: null });
    leadsUpdateResults.push({ error: null });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn() })
    );

    await act(async () => {
      await result.current.markAsLost(undefined, "Archived");
    });

    const toastArgs = toastMock.mock.calls[0]?.[0];
    expect(toastArgs).toMatchObject({
      description: "Lead marked as Archived",
    });
    expect(toastArgs.action).toBeUndefined();
    expect(leadStatusesQuery.eq).toHaveBeenCalledWith("name", "Archived");
  });
});
