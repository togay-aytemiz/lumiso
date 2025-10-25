jest.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: jest.fn(),
}));

jest.mock("@/hooks/useOrganizationData", () => ({
  useLeadStatuses: jest.fn(),
}));

jest.mock("@/services/LeadDetailService", () => ({
  fetchLeadById: jest.fn(),
  fetchLeadSessions: jest.fn(),
  fetchLeadProjectSummary: jest.fn(),
  fetchLatestLeadActivity: jest.fn(),
}));

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useLeadDetailData } from "../useLeadDetailData";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useLeadStatuses } from "@/hooks/useOrganizationData";
import {
  fetchLeadById,
  fetchLeadSessions,
  fetchLeadProjectSummary,
  fetchLatestLeadActivity,
} from "@/services/LeadDetailService";

const useOrganizationMock = useOrganization as jest.Mock;
const useLeadStatusesMock = useLeadStatuses as jest.Mock;
const fetchLeadByIdMock = fetchLeadById as jest.Mock;
const fetchLeadSessionsMock = fetchLeadSessions as jest.Mock;
const fetchLeadProjectSummaryMock = fetchLeadProjectSummary as jest.Mock;
const fetchLatestLeadActivityMock = fetchLatestLeadActivity as jest.Mock;

describe("useLeadDetailData", () => {
  let queryClient: QueryClient;

  const wrapper =
    () =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    useOrganizationMock.mockReset();
    useLeadStatusesMock.mockReset();
    fetchLeadByIdMock.mockReset();
    fetchLeadSessionsMock.mockReset();
    fetchLeadProjectSummaryMock.mockReset();
    fetchLatestLeadActivityMock.mockReset();

    useOrganizationMock.mockReturnValue({
      activeOrganizationId: "org-1",
      loading: false,
    });

    useLeadStatusesMock.mockReturnValue({
      data: [{ id: "status-1", name: "Qualified" }],
      isLoading: false,
    });

    fetchLeadByIdMock.mockResolvedValue({
      id: "lead-1",
      name: "Jane Doe",
      status: "Qualified",
      status_id: "status-1",
      email: "jane@example.com",
      phone: null,
      notes: null,
      created_at: "2025-05-01T10:00:00Z",
      updated_at: "2025-05-05T10:00:00Z",
      user_id: "user-1",
    });

    fetchLeadSessionsMock.mockResolvedValue([]);

    fetchLeadProjectSummaryMock.mockResolvedValue({
      hasProjects: false,
      summary: { count: 0, latestUpdate: null },
      payments: {
        totalPaid: 0,
        total: 0,
        remaining: 0,
        currency: "TRY",
      },
    });

    fetchLatestLeadActivityMock.mockResolvedValue(null);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("aggregates lead details, sessions, and metrics", async () => {
    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    const now = new Date();
    const today = formatDate(now);
    const overdue = formatDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000));
    const upcoming = formatDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));

    const todayUpdate = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const upcomingUpdate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const sessions = [
      {
        id: "session-overdue",
        lead_id: "lead-1",
        project_id: null,
        session_date: overdue,
        session_time: null,
        status: "Planned",
        notes: null,
        created_at: "2025-05-01T09:00:00Z",
        updated_at: "2025-05-08T09:00:00Z",
        projects: { name: "Old Project", status_id: null },
      },
      {
        id: "session-today",
        lead_id: "lead-1",
        project_id: "proj-1",
        session_date: today,
        session_time: "08:00:00",
        status: "Planned",
        notes: "Prep call",
        created_at: "2025-05-02T09:00:00Z",
        updated_at: todayUpdate,
        projects: { name: "Wedding Shoot", status_id: "active" },
      },
      {
        id: "session-upcoming",
        lead_id: "lead-1",
        project_id: "proj-2",
        session_date: upcoming,
        session_time: "11:00:00",
        status: "Confirmed",
        notes: null,
        created_at: "2025-05-03T09:00:00Z",
        updated_at: upcomingUpdate,
        projects: { name: "Engagement", status_id: "active" },
      },
    ];

    fetchLeadSessionsMock.mockResolvedValue(sessions);
    fetchLeadProjectSummaryMock.mockResolvedValue({
      hasProjects: true,
      summary: { count: 2, latestUpdate: "2025-05-09T12:00:00Z" },
      payments: {
        totalPaid: 500,
        total: 1500,
        remaining: 1000,
        currency: "USD",
      },
    });
    fetchLatestLeadActivityMock.mockResolvedValue("2025-05-09T15:00:00Z");

    const { result } = renderHook(() => useLeadDetailData("lead-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchLeadByIdMock).toHaveBeenCalledWith("lead-1");
    expect(fetchLeadSessionsMock).toHaveBeenCalledWith("lead-1", "org-1");
    expect(result.current.lead?.name).toBe("Jane Doe");

    expect(result.current.sessions).toHaveLength(3);
    expect(result.current.sessions[0]).toMatchObject({
      id: "session-today",
      project_name: "Wedding Shoot",
    });
    expect(result.current.sessions[1]).toMatchObject({
      id: "session-overdue",
      project_name: "Old Project",
    });
    expect(result.current.sessions[2]).toMatchObject({
      id: "session-upcoming",
      project_name: "Engagement",
    });

    expect(result.current.sessionMetrics).toEqual({
      todayCount: 1,
      todayNext: expect.objectContaining({ id: "session-today" }),
      nextUpcoming: expect.objectContaining({ id: "session-upcoming" }),
      overdueCount: 1,
    });

    expect(result.current.latestSessionUpdate).toBe(upcomingUpdate);
    expect(result.current.projectSummary).toEqual({
      count: 2,
      latestUpdate: "2025-05-09T12:00:00Z",
    });
    expect(result.current.aggregatedPayments).toEqual({
      totalPaid: 500,
      total: 1500,
      remaining: 1000,
      currency: "USD",
    });
    expect(result.current.latestLeadActivity).toBe("2025-05-09T15:00:00Z");
    expect(result.current.leadStatuses).toEqual([
      { id: "status-1", name: "Qualified" },
    ]);
    expect(result.current.hasProjects).toBe(true);
  });

  it("refetchAll triggers all underlying queries", async () => {
    fetchLeadSessionsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useLeadDetailData("lead-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refetchAll();
    });

    expect(fetchLeadByIdMock).toHaveBeenCalledTimes(2);
    expect(fetchLeadSessionsMock).toHaveBeenCalledTimes(2);
    expect(fetchLeadProjectSummaryMock).toHaveBeenCalledTimes(2);
    expect(fetchLatestLeadActivityMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to defaults when queries return no data", async () => {
    fetchLeadByIdMock.mockResolvedValue(null);
    fetchLeadSessionsMock.mockResolvedValue([]);
    fetchLeadProjectSummaryMock.mockResolvedValue({
      hasProjects: false,
      summary: undefined,
      payments: undefined,
    });
    fetchLatestLeadActivityMock.mockResolvedValue(null);

    const { result } = renderHook(() => useLeadDetailData("lead-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.lead).toBeNull();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.sessionMetrics).toEqual({
      todayCount: 0,
      todayNext: null,
      nextUpcoming: null,
      overdueCount: 0,
    });
    expect(result.current.latestSessionUpdate).toBeNull();
    expect(result.current.projectSummary).toEqual({
      count: 0,
      latestUpdate: null,
    });
    expect(result.current.aggregatedPayments).toEqual({
      totalPaid: 0,
      total: 0,
      remaining: 0,
      currency: "TRY",
    });
    expect(result.current.hasProjects).toBe(false);
    expect(result.current.latestLeadActivity).toBeNull();
  });
});
