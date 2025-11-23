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

const translations: Record<string, string> = {
  "status.statusUpdated": "Status Updated",
  "status.leadMarkedAs": "Lead marked as {{status}}",
  "status.undoStatusChange": "Undo status change",
  "status.undo": "Undo",
  "status.undone": "Undone",
  "status.statusRevertedTo": "Status reverted to {{status}}",
  "status.undoFailed": "Undo failed",
  "status.undoFailedDescription": "Unable to undo status change",
  "status.unableToUpdateStatus": "Unable to update lead status",
  "status.errorUpdatingStatus": "Error updating status"
};

jest.mock("react-i18next", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const template = translations[key] ?? options?.defaultValue ?? key;
      if (!options) return template;

      return template.replace(/{{\s*(\w+)\s*}}/g, (_match, variable) =>
        options[variable] ?? ""
      );
    },
    i18n: {
      language: "en",
      resolvedLanguage: "en"
    }
  }),
}));

import React from "react";
import { renderHook, act } from "@testing-library/react";

import { useLeadStatusActions } from "../useLeadStatusActions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const authMock = supabase.auth.getUser as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;
const fromMock = supabase.from as jest.Mock;

type LeadStatusRecord = { id: string; name: string };
type LeadStatusResponse = { data: LeadStatusRecord | null; error: Error | null };

const leadStatusQueue: LeadStatusResponse[] = [];
const leadStatusLifecycleQueue: Array<{ data: LeadStatusRecord[]; error: Error | null }> = [];
const leadStatusesQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockImplementation(() =>
    Promise.resolve(leadStatusQueue.shift() ?? { data: null, error: null })
  ),
  order: jest.fn().mockImplementation(() =>
    Promise.resolve(leadStatusLifecycleQueue.shift() ?? { data: [], error: null })
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
  leadStatusesQuery.order.mockClear();
  leadStatusLifecycleQueue.length = 0;

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

const mockStatuses = [
  { id: "status-complete", name: "Completed", lifecycle: "completed" },
  { id: "status-prev", name: "Qualified", lifecycle: "active" },
  { id: "status-archived", name: "Archived", lifecycle: "cancelled" }
] as unknown as Array<Database["public"]["Tables"]["lead_statuses"]["Row"]>;

describe("useLeadStatusActions", () => {
  it("updates status, triggers callbacks, and supports undo", async () => {
    const onStatusChange = jest.fn();

    leadsUpdateResults.push({ error: null }, { error: null });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange, statuses: mockStatuses })
    );

    await act(async () => {
      await result.current.markAsCompleted("Qualified");
    });

    expect(result.current.isUpdating).toBe(false);
    expect(authMock).toHaveBeenCalled();
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
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn(), statuses: mockStatuses })
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

  it("surfaces errors from lead update", async () => {
    leadsUpdateResults.push({ error: new Error("status lookup failed") });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn(), statuses: mockStatuses })
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
    leadsUpdateResults.push({ error: null });

    const { result } = renderHook(() =>
      useLeadStatusActions({ leadId: "lead-1", onStatusChange: jest.fn(), statuses: mockStatuses })
    );

    await act(async () => {
      await result.current.markAsLost(undefined, "Archived");
    });

    const toastArgs = toastMock.mock.calls[0]?.[0];
    expect(toastArgs).toMatchObject({
      description: "Lead marked as Archived",
    });
    expect(toastArgs.action).toBeUndefined();
  });
});
