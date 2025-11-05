import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type AuditLogInsert = Database["public"]["Tables"]["audit_log"]["Insert"];

interface AuditLogParams {
  entityType: AuditLogInsert["entity_type"];
  entityId: AuditLogInsert["entity_id"];
  action: AuditLogInsert["action"];
  oldValues?: Json | null;
  newValues?: Json | null;
}

export async function logAuditEvent({
  entityType,
  entityId,
  action,
  oldValues = null,
  newValues = null,
}: AuditLogParams) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) {
      console.warn("logAuditEvent skipped: no authenticated user");
      return;
    }

    const { error } = await supabase.from("audit_log").insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
    });

    if (error) {
      console.error("Failed to insert audit log entry:", error);
    }
  } catch (error) {
    console.error("Unexpected error while inserting audit log entry:", error);
  }
}
