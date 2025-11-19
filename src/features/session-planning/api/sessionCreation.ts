import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { formatDate, formatTime } from "@/lib/utils";

export interface CreateSessionPayload {
  leadId: string;
  leadName?: string;
  sessionName?: string;
  sessionDate: string;
  sessionTime: string;
  notes?: string;
  location?: string;
  meetingUrl?: string;
  projectId?: string;
  sessionTypeId?: string;
  status?: string;
}

export interface CreateSessionOptions {
  /**
   * When true we create a lead activity entry summarising the scheduled session
   * (default: true when no projectId).
   */
  createActivity?: boolean;
}

export interface CreateSessionResult {
  sessionId: string;
  organizationId: string;
  userId: string;
}

export async function createSession(
  payload: CreateSessionPayload,
  options: CreateSessionOptions = {}
): Promise<CreateSessionResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }
  const user = authData?.user;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  const { data: newSession, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      lead_id: payload.leadId,
      project_id: payload.projectId ?? null,
      session_name: payload.sessionName?.trim() || null,
      session_date: payload.sessionDate,
      session_time: payload.sessionTime,
      notes: payload.notes?.trim() || null,
      location: payload.location?.trim() || null,
      session_type_id: payload.sessionTypeId ?? null,
      status: payload.status ?? "planned"
    })
    .select("id")
    .single();

  if (sessionError) {
    throw sessionError;
  }

  const shouldCreateActivity = options.createActivity ?? !payload.projectId;
  if (shouldCreateActivity && payload.leadName) {
    const sessionDate = payload.sessionDate ? formatDate(payload.sessionDate) : "";
    const sessionTime = payload.sessionTime ? formatTime(payload.sessionTime) : "";
    const activityKey = sessionDate && sessionTime
      ? "forms:activities.session_scheduled_with_time"
      : "forms:activities.session_scheduled";
    const activityContent = i18n.t(activityKey, {
      date: sessionDate,
      time: sessionTime
    });

    const { error: activityError } = await supabase
      .from("activities")
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        lead_id: payload.leadId,
        type: "note",
        content: activityContent
      });

    if (activityError) {
      console.error("Error creating session activity:", activityError);
    }
  }

  return {
    sessionId: newSession.id,
    organizationId,
    userId: user.id
  };
}

export interface UpdateSessionPayload {
  sessionId: string;
  leadId: string;
  sessionName?: string;
  sessionDate: string;
  sessionTime: string;
  notes?: string;
  location?: string;
  meetingUrl?: string;
  projectId?: string;
  sessionTypeId?: string;
}

export interface UpdateSessionResult {
  organizationId: string;
}

export async function updateSession(payload: UpdateSessionPayload): Promise<UpdateSessionResult> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }
  const user = authData?.user;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      lead_id: payload.leadId,
      project_id: payload.projectId ?? null,
      session_name: payload.sessionName?.trim() || null,
      session_date: payload.sessionDate,
      session_time: payload.sessionTime,
      notes: payload.notes?.trim() || null,
      location: payload.location?.trim() || null,
      session_type_id: payload.sessionTypeId ?? null
    })
    .eq("id", payload.sessionId);

  if (updateError) {
    throw updateError;
  }

  return {
    organizationId
  };
}
