import { sortSessionsByLifecycle, type SessionWithStatus } from "./sessionSorting";

function buildSession(overrides: Partial<SessionWithStatus>): SessionWithStatus {
  return {
    id: overrides.id ?? "session-id",
    session_date: overrides.session_date ?? "2025-01-01",
    session_time: overrides.session_time,
    notes: overrides.notes,
    status: overrides.status ?? "planned",
    status_id: overrides.status_id,
    project_id: overrides.project_id,
    lead_id: overrides.lead_id ?? "lead-1",
    session_statuses:
      overrides.session_statuses ?? null,
    projects: overrides.projects,
  };
}

describe("sortSessionsByLifecycle", () => {
  it("prioritizes active sessions before completed and cancelled lifecycles", () => {
    const sessions: SessionWithStatus[] = [
      buildSession({
        id: "cancelled-modern",
        session_date: "2025-01-08",
        session_time: "14:00",
        session_statuses: {
          id: "status-cancelled",
          name: "Cancelled",
          lifecycle: "cancelled",
        },
        status: "Cancelled",
      }),
      buildSession({
        id: "completed-legacy",
        session_date: "2025-01-07",
        session_time: "10:00",
        status: "completed",
      }),
      buildSession({
        id: "active-modern",
        session_date: "2025-01-05",
        session_time: "09:00",
        session_statuses: {
          id: "status-active",
          name: "Active",
          lifecycle: "active",
        },
        status: "Scheduled",
      }),
      buildSession({
        id: "active-legacy",
        session_date: "2025-01-06",
        session_time: "12:00",
        status: "planned",
      }),
    ];

    const sorted = sortSessionsByLifecycle(sessions).map((session) => session.id);

    expect(sorted).toEqual([
      "active-modern",
      "active-legacy",
      "completed-legacy",
      "cancelled-modern",
    ]);
  });

  it("sorts active sessions ascending while completed and cancelled descend by time", () => {
    const sessions: SessionWithStatus[] = [
      buildSession({
        id: "completed-recent",
        session_date: "2025-01-10",
        session_time: "15:00",
        session_statuses: {
          id: "status-completed",
          name: "Completed",
          lifecycle: "completed",
        },
      }),
      buildSession({
        id: "completed-older",
        session_date: "2025-01-08",
        session_time: "11:00",
        session_statuses: {
          id: "status-completed-2",
          name: "Completed",
          lifecycle: "completed",
        },
      }),
      buildSession({
        id: "cancelled-recent",
        session_date: "2025-01-12",
        session_time: "09:00",
        session_statuses: {
          id: "status-cancelled-2",
          name: "Cancelled",
          lifecycle: "cancelled",
        },
      }),
      buildSession({
        id: "cancelled-older",
        session_date: "2025-01-09",
        session_time: "13:00",
        session_statuses: {
          id: "status-cancelled-3",
          name: "Cancelled",
          lifecycle: "cancelled",
        },
      }),
      buildSession({
        id: "active-soonest",
        session_date: "2025-01-03",
        session_time: "08:00",
        session_statuses: {
          id: "status-active-1",
          name: "Confirmed",
          lifecycle: "active",
        },
      }),
      buildSession({
        id: "active-later",
        session_date: "2025-01-04",
        session_time: "10:30",
        session_statuses: {
          id: "status-active-2",
          name: "Confirmed",
          lifecycle: "active",
        },
      }),
    ];

    const sorted = sortSessionsByLifecycle(sessions).map((session) => session.id);

    expect(sorted).toEqual([
      "active-soonest",
      "active-later",
      "completed-recent",
      "completed-older",
      "cancelled-recent",
      "cancelled-older",
    ]);
  });

  it("treats unknown legacy statuses as active and leaves original array untouched", () => {
    const sessions: SessionWithStatus[] = [
      buildSession({
        id: "mystery",
        session_date: "2025-02-01",
        status: "mystery-status",
      }),
      buildSession({
        id: "completed",
        session_date: "2025-01-15",
        status: "delivered",
      }),
      buildSession({
        id: "cancelled",
        session_date: "2025-01-20",
        status: "cancelled",
      }),
    ];

    const originalOrder = sessions.map((session) => session.id);

    const sorted = sortSessionsByLifecycle(sessions).map((session) => session.id);

    expect(sorted).toEqual(["mystery", "completed", "cancelled"]);
    expect(sessions.map((session) => session.id)).toEqual(originalOrder);
  });
});
