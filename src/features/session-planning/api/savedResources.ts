import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";

export interface SavedLocationRecord {
  id: string;
  label: string;
  address: string;
  meetingUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedNotePresetRecord {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const mapLocation = (row: any): SavedLocationRecord => ({
  id: row.id,
  label: row.label,
  address: row.address,
  meetingUrl: row.meeting_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapNotePreset = (row: any): SavedNotePresetRecord => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");
  return user.id;
}

export async function fetchSavedLocations(): Promise<SavedLocationRecord[]> {
  await requireUser();
  const { data, error } = await supabase
    .from("session_saved_locations")
    .select("id,label,address,meeting_url,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLocation);
}

export async function createSavedLocation(payload: {
  label: string;
  address: string;
  meetingUrl?: string;
}): Promise<SavedLocationRecord> {
  const userId = await requireUser();
  const organizationId = await getUserOrganizationId();

  const { data, error } = await supabase
    .from("session_saved_locations")
    .insert({
      label: payload.label.trim(),
      address: payload.address.trim(),
      meeting_url: payload.meetingUrl?.trim() || null,
      user_id: userId,
      organization_id: organizationId ?? null,
    })
    .select("id,label,address,meeting_url,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapLocation(data);
}

export async function updateSavedLocation(
  id: string,
  payload: {
    label: string;
    address: string;
    meetingUrl?: string;
  }
): Promise<SavedLocationRecord> {
  await requireUser();
  const { data, error } = await supabase
    .from("session_saved_locations")
    .update({
      label: payload.label.trim(),
      address: payload.address.trim(),
      meeting_url: payload.meetingUrl?.trim() || null,
    })
    .eq("id", id)
    .select("id,label,address,meeting_url,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapLocation(data);
}

export async function deleteSavedLocation(id: string): Promise<void> {
  await requireUser();
  const { error } = await supabase
    .from("session_saved_locations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchSavedNotePresets(): Promise<
  SavedNotePresetRecord[]
> {
  await requireUser();
  const { data, error } = await supabase
    .from("session_saved_note_presets")
    .select("id,title,body,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNotePreset);
}

export async function createSavedNotePreset(payload: {
  title: string;
  body: string;
}): Promise<SavedNotePresetRecord> {
  const userId = await requireUser();
  const organizationId = await getUserOrganizationId();
  const { data, error } = await supabase
    .from("session_saved_note_presets")
    .insert({
      title: payload.title.trim(),
      body: payload.body.trim(),
      user_id: userId,
      organization_id: organizationId ?? null,
    })
    .select("id,title,body,created_at,updated_at")
    .single();
  if (error) throw error;
  return mapNotePreset(data);
}

export async function deleteSavedNotePreset(id: string): Promise<void> {
  await requireUser();
  const { error } = await supabase
    .from("session_saved_note_presets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
