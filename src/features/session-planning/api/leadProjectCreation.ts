import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface CreateLeadPayload {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface CreateLeadResult {
  id: string;
  name: string;
}

export async function createLead(payload: CreateLeadPayload): Promise<CreateLeadResult> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  const { data, error: insertError } = await supabase
    .from("leads")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      notes: payload.notes?.trim() || null,
      status: "booked"
    })
    .select("id, name")
    .single();

  if (insertError) throw insertError;

  return {
    id: data.id,
    name: data.name
  };
}

export interface CreateProjectPayload {
  leadId: string;
  name: string;
  description?: string;
}

export interface CreateProjectResult {
  id: string;
  name: string;
}

export async function createProject(payload: CreateProjectPayload): Promise<CreateProjectResult> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");

  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    throw new Error("Organization required");
  }

  const { data, error: insertError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      lead_id: payload.leadId,
      name: payload.name.trim(),
      description: payload.description?.trim() || null
    })
    .select("id, name")
    .single();

  if (insertError) throw insertError;

  return {
    id: data.id,
    name: data.name
  };
}
