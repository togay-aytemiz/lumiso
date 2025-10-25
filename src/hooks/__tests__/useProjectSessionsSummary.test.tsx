jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { renderHook, waitFor } from "@testing-library/react";

import { useProjectSessionsSummary } from "../useProjectSessionsSummary";
import { supabase } from "@/integrations/supabase/client";

const supabaseFromMock = supabase.from as jest.Mock;

const createSessionsChain = (result: { data: unknown; error: unknown }) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn((_column: string, _options?: unknown) => ({
        order: jest.fn((_column2: string, _options2?: unknown) =>
          Promise.resolve(result)
        ),
      })),
    })),
  })),
});

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const shiftDate = (base: Date, deltaDays: number) => {
  const shifted = new Date(base);
  shifted.setDate(base.getDate() + deltaDays);
  return shifted;
};

describe("useProjectSessionsSummary", () => {
beforeEach(() => {
  supabaseFromMock.mockReset();
});

  it("computes session metrics across statuses", async () => {
    const now = new Date();
    const sessions = [
      {
        id: "overdue",
        session_date: formatDate(shiftDate(now, -2)),
        session_time: "08:00:00",
        status: "Planned",
      },
      {
        id: "today",
        session_date: formatDate(now),
        session_time: "07:30:00",
        status: "Confirmed",
      },
      {
        id: "upcoming",
        session_date: formatDate(shiftDate(now, 2)),
        session_time: "11:00:00",
        status: "Scheduled",
      },
      {
        id: "completed",
        session_date: formatDate(shiftDate(now, -5)),
        session_time: "09:00:00",
        status: "Completed",
      },
      {
        id: "cancelled",
        session_date: formatDate(shiftDate(now, -4)),
        session_time: null,
        status: "Cancelled",
      },
      {
        id: "unknown",
        session_date: formatDate(shiftDate(now, 4)),
        session_time: null,
        status: "SomeCustomStatus",
      },
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      expect(table).toBe("sessions");
      return createSessionsChain({ data: sessions, error: null });
    });

    const { result } = renderHook(() => useProjectSessionsSummary("project-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toMatchObject({
      total: 6,
      activeCount: 4,
      completedCount: 1,
      cancelledCount: 1,
      overdueCount: 1,
      todayCount: 1,
    });
    expect(result.current.summary.overdueNext?.id).toBe("overdue");
    expect(result.current.summary.todayNext?.id).toBe("today");
    expect(result.current.summary.nextUpcoming?.id).toBe("upcoming");
    expect(result.current.summary.latestCompleted?.id).toBe("completed");
  });

  it("falls back to initial summary when Supabase errors", async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      expect(table).toBe("sessions");
      return createSessionsChain({
        data: null,
        error: new Error("load failed"),
      });
    });

    const { result } = renderHook(() => useProjectSessionsSummary("project-err"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toEqual({
      total: 0,
      activeCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      overdueCount: 0,
      overdueNext: null,
      todayCount: 0,
      todayNext: null,
      nextUpcoming: null,
      latestCompleted: null,
    });
  });

  it("returns initial summary immediately when projectId missing", async () => {
    const { result } = renderHook(() => useProjectSessionsSummary(""));

    expect(result.current.loading).toBe(false);
    expect(result.current.summary.total).toBe(0);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("recomputes when refresh trigger changes", async () => {
    const now = new Date();
    const responseQueue = [
      createSessionsChain({
        data: [
          {
            id: "first",
            session_date: formatDate(shiftDate(now, -1)),
            session_time: null,
            status: "planned",
          },
        ],
        error: null,
      }),
      createSessionsChain({
        data: [
          {
            id: "second",
            session_date: formatDate(shiftDate(now, 1)),
            session_time: null,
            status: "planned",
          },
        ],
        error: null,
      }),
    ];

    supabaseFromMock.mockImplementation((table: string) => {
      expect(table).toBe("sessions");
      const chain = responseQueue.shift();
      if (!chain) {
        throw new Error("No more mock responses");
      }
      return chain;
    });

    const { result, rerender } = renderHook(
      ({ refresh }: { refresh?: number }) =>
        useProjectSessionsSummary("project-1", refresh),
      { initialProps: { refresh: 1 } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary.total).toBe(1);
    expect(result.current.summary.nextUpcoming).toBeNull();
    expect(result.current.summary.todayNext).toBeNull();

    rerender({ refresh: 2 });

    await waitFor(() => expect(result.current.summary.nextUpcoming?.id).toBe("second"));
  });
});
