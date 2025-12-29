jest.mock("@/integrations/supabase/client", () => {
  const from = jest.fn();
  const rpc = jest.fn();
  const auth = {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  };

  return {
    __esModule: true,
    supabase: {
      from,
      rpc,
      auth,
      functions: {
        invoke: jest.fn(),
      },
    },
  };
});

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import React, { type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useUserPreferences } from "../useUserPreferences";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const fromMock = supabase.from as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

const baseUser = { id: "user-1" } as { id: string };
const USER_PREFS_KEY = "user-preferences";

type SelectResult = { data: Record<string, unknown> | null; error: Error | null };
type UpdateResult = { error: Error | null };
type InsertResult = { error: Error | null };

function createSelectTable(result: SelectResult) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });

  return {
    table: {
      select,
      insert: jest.fn(),
      update: jest.fn(),
    },
    select,
    eq,
    maybeSingle,
  };
}

function createInsertTable(result: InsertResult) {
  const insert = jest.fn().mockResolvedValue(result);
  return {
    table: {
      select: jest.fn(),
      insert,
      update: jest.fn(),
    },
    insert,
  };
}

function createUpdateTable(result: UpdateResult) {
  const eq = jest.fn().mockResolvedValue(result);
  const update = jest.fn().mockReturnValue({ eq });
  return {
    table: {
      select: jest.fn(),
      insert: jest.fn(),
      update,
    },
    update,
    eq,
  };
}

let queryClient: QueryClient;

const createWrapper =
  () =>
  ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  fromMock.mockReset();
  useAuthMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe("useUserPreferences", () => {
  it("disables fetching when no authenticated user is present", () => {
    useAuthMock.mockReturnValue({ user: null });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    expect(result.current.isReady).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns user preferences from existing records", async () => {
    useAuthMock.mockReturnValue({ user: baseUser });

    const selectCall = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "in_progress",
        current_onboarding_step: 3,
        welcome_modal_shown: true,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    fromMock.mockImplementationOnce((table: string) => {
      expect(table).toBe("user_settings");
      return selectCall.table;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(selectCall.select).toHaveBeenCalledWith(`
      user_id,
      onboarding_stage,
      current_onboarding_step,
      welcome_modal_shown,
      page_videos,
      updated_at
    `);
    expect(selectCall.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result.current.data).toMatchObject({
      userId: "user-1",
      onboardingStage: "in_progress",
      currentOnboardingStep: 3,
      welcomeModalShown: true,
      timeFormat: "12-hour",
      dateFormat: "DD/MM/YYYY",
    });
  });

  it("creates default preferences when no record exists", async () => {
    useAuthMock.mockReturnValue({ user: baseUser });

    const selectCall = createSelectTable({ data: null, error: null });
    const insertCall = createInsertTable({ error: null });

    fromMock
      .mockImplementationOnce(() => selectCall.table)
      .mockImplementationOnce(() => insertCall.table);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(insertCall.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      onboarding_stage: "not_started",
      current_onboarding_step: 1,
      welcome_modal_shown: false,
      page_videos: {},
    });

    expect(result.current.data).toMatchObject({
      userId: "user-1",
      onboardingStage: "not_started",
      currentOnboardingStep: 1,
      welcomeModalShown: false,
      primaryBrandColor: "#1EB29F",
      timezone: "UTC",
    });
  });

  it("applies optimistic updates and persists onboarding fields", async () => {
    useAuthMock.mockReturnValue({ user: baseUser });

    const initialSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    const updateCall = createUpdateTable({ error: null });

    const refreshedSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "completed",
        current_onboarding_step: 5,
        welcome_modal_shown: true,
        updated_at: "2025-10-21T00:00:00.000Z",
      },
      error: null,
    });

    fromMock
      .mockImplementationOnce(() => initialSelect.table)
      .mockImplementationOnce(() => updateCall.table)
      .mockImplementationOnce(() => refreshedSelect.table);

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.updatePreferences({
        onboardingStage: "completed",
        currentOnboardingStep: 5,
        welcomeModalShown: true,
      });
    });

    expect(updateCall.update).toHaveBeenCalledWith({
      onboarding_stage: "completed",
      current_onboarding_step: 5,
      welcome_modal_shown: true,
    });
    expect(updateCall.eq).toHaveBeenCalledWith("user_id", "user-1");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [USER_PREFS_KEY, "user-1"],
    });

    await waitFor(() =>
      expect(result.current.data?.onboardingStage).toBe("completed")
    );
    expect(result.current.data?.currentOnboardingStep).toBe(5);
    expect(result.current.data?.welcomeModalShown).toBe(true);
  });

  it("reverts optimistic update when persistence fails", async () => {
    useAuthMock.mockReturnValue({ user: baseUser });

    const initialSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    const updateCall = createUpdateTable({
      error: new Error("update failed"),
    });

    const refetchSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    fromMock
      .mockImplementationOnce(() => initialSelect.table)
      .mockImplementationOnce(() => updateCall.table)
      .mockImplementationOnce(() => refetchSelect.table);

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    await expect(
      act(async () => {
        await result.current.updatePreferences({
          onboardingStage: "completed",
        });
      })
    ).rejects.toThrow("update failed");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [USER_PREFS_KEY, "user-1"],
    });

    await waitFor(() =>
      expect(result.current.data?.onboardingStage).toBe("not_started")
    );
  });

  it("provides helpers to force refresh and clear cached data", async () => {
    useAuthMock.mockReturnValue({ user: baseUser });

    const selectCall = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    // initial fetch + refetch after forceRefresh + refetch after clear cache invalidation
    const secondSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    const thirdSelect = createSelectTable({
      data: {
        user_id: "user-1",
        onboarding_stage: "not_started",
        current_onboarding_step: 1,
        welcome_modal_shown: false,
        updated_at: "2025-10-20T00:00:00.000Z",
      },
      error: null,
    });

    fromMock
      .mockImplementationOnce(() => selectCall.table)
      .mockImplementationOnce(() => secondSelect.table)
      .mockImplementationOnce(() => thirdSelect.table);

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const removeSpy = jest.spyOn(queryClient, "removeQueries");

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUserPreferences(), { wrapper });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.forceRefresh();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [USER_PREFS_KEY],
    });

    act(() => {
      result.current.clearCache();
    });

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: [USER_PREFS_KEY],
    });
  });
});
