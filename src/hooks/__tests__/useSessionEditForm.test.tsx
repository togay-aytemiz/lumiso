jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}));

jest.mock("@/hooks/useWorkflowTriggers", () => ({
  useWorkflowTriggers: jest.fn(),
}));

jest.mock("@/hooks/useSessionReminderScheduling", () => ({
  useSessionReminderScheduling: jest.fn(),
}));

jest.mock("@/lib/validation", () => ({
  sessionSchema: {
    parseAsync: jest.fn(),
  },
  sanitizeInput: jest.fn((value: string) => `sanitized:${value}`),
  sanitizeHtml: jest.fn(async (value: string) => `clean:${value}`),
}));

jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/lib/sessionUtils", () => ({
  generateSessionName: jest.fn(() => "Generated Session Name"),
}));

import { act, renderHook } from "@testing-library/react";
import { ZodError } from "zod";

import { useSessionEditForm } from "../useSessionEditForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useSessionReminderScheduling } from "@/hooks/useSessionReminderScheduling";
import {
  sessionSchema,
  sanitizeInput,
  sanitizeHtml,
} from "@/lib/validation";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { generateSessionName } from "@/lib/sessionUtils";

const toastMock = toast as jest.Mock;
const supabaseFromMock = supabase.from as jest.Mock;
const sessionSchemaMock = sessionSchema.parseAsync as jest.Mock;
const sanitizeInputMock = sanitizeInput as jest.Mock;
const sanitizeHtmlMock = sanitizeHtml as jest.Mock;
const getUserOrganizationIdMock = getUserOrganizationId as jest.Mock;
const generateSessionNameMock = generateSessionName as jest.Mock;

const triggerSessionRescheduledMock = jest.fn();
const rescheduleSessionRemindersMock = jest.fn();

const initialProps = {
  sessionId: "session-1",
  leadId: "lead-1",
  leadName: "Taylor",
  initialData: {
    session_name: "Original Name",
    session_date: "2025-01-10",
    session_time: "10:00",
    notes: "Bring props",
    location: "Studio",
    project_id: "project-1",
  },
  onSuccess: jest.fn(),
};

function createSupabaseMock() {
  const eqMock = jest.fn().mockResolvedValue({ error: null });
  const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
  supabaseFromMock.mockReturnValue({ update: updateMock });
  return { updateMock, eqMock };
}

describe("useSessionEditForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWorkflowTriggers as jest.Mock).mockReturnValue({
      triggerSessionRescheduled: triggerSessionRescheduledMock,
    });
    (useSessionReminderScheduling as jest.Mock).mockReturnValue({
      rescheduleSessionReminders: rescheduleSessionRemindersMock,
    });
    sessionSchemaMock.mockResolvedValue(true);
    sanitizeInputMock.mockImplementation((value: string) => `sanitized:${value}`);
    sanitizeHtmlMock.mockImplementation(async (value: string) => `clean:${value}`);
    getUserOrganizationIdMock.mockResolvedValue("org-1");
    generateSessionNameMock.mockReturnValue("Generated Session Name");
  });

  it("tracks dirty state and clears field errors on change", () => {
    const { result } = renderHook(() => useSessionEditForm(initialProps));

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.handleInputChange("session_name", "Updated Name");
    });

    expect(result.current.formData.session_name).toBe("Updated Name");
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.handleInputChange("session_name", "Original Name");
    });

    expect(result.current.isDirty).toBe(false);
  });

  it("validates form and aborts submit on schema errors", async () => {
    const issues = [
      {
        message: "Required",
        path: ["session_date"],
        code: "custom",
      },
    ];
    sessionSchemaMock.mockRejectedValueOnce(new ZodError(issues));

    const { result } = renderHook(() => useSessionEditForm(initialProps));

    const success = await act(async () => result.current.submitForm());

    expect(success).toBe(false);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Validation error",
      description: "Please fix the validation errors before saving.",
      variant: "destructive",
    });
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("shows validation error when required fields missing", async () => {
    const { result } = renderHook(() => useSessionEditForm(initialProps));

    act(() => {
      result.current.handleInputChange("session_date", "");
    });

    const success = await act(async () => result.current.submitForm());

    expect(success).toBe(false);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Validation error",
      description: "Date and time are required.",
      variant: "destructive",
    });
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("updates session and triggers workflows when date/time changes", async () => {
    const { updateMock, eqMock } = createSupabaseMock();

    const { result } = renderHook(() => useSessionEditForm(initialProps));

    act(() => {
      result.current.handleInputChange("session_date", "2025-01-11");
      result.current.handleInputChange("session_time", "14:30");
      result.current.handleInputChange("session_name", "");
      result.current.handleInputChange("notes", "Updated notes");
    });

    const success = await act(async () => result.current.submitForm());

    expect(success).toBe(true);
    expect(result.current.loading).toBe(false);

    expect(sanitizeInputMock).toHaveBeenCalledWith("Generated Session Name");
    expect(sanitizeHtmlMock).toHaveBeenCalledWith("Updated notes");
    expect(updateMock).toHaveBeenCalledWith({
      session_name: "sanitized:Generated Session Name",
      session_date: "sanitized:2025-01-11",
      session_time: "sanitized:14:30",
      notes: "clean:Updated notes",
      location: "Studio",
      project_id: "project-1",
    });
    expect(eqMock).toHaveBeenCalledWith("id", "session-1");

    expect(triggerSessionRescheduledMock).toHaveBeenCalledWith(
      "session-1",
      "org-1",
      "2025-01-10 10:00",
      "2025-01-11 14:30",
      expect.objectContaining({
        lead_id: "lead-1",
        client_name: "Taylor",
        project_id: "project-1",
      })
    );
    expect(rescheduleSessionRemindersMock).toHaveBeenCalledWith("session-1");
    expect(initialProps.onSuccess).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Success",
      description: "Session updated successfully.",
    });
  });

  it("handles supabase update errors gracefully", async () => {
    const eqMock = jest.fn().mockResolvedValue({
      error: new Error("Update failed"),
    });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    supabaseFromMock.mockReturnValue({ update: updateMock });

    const { result } = renderHook(() => useSessionEditForm(initialProps));

    const success = await act(async () => result.current.submitForm());

    expect(success).toBe(false);
    expect(toastMock).toHaveBeenCalledWith({
      title: "Error updating session",
      description: "Update failed",
      variant: "destructive",
    });
    expect(triggerSessionRescheduledMock).not.toHaveBeenCalled();
    expect(rescheduleSessionRemindersMock).not.toHaveBeenCalled();
  });
});
