import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

interface WorkflowEvent {
  value: string;
  label: string;
  description: string;
  category: string;
}

export function useWorkflowEvents() {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeOrganization } = useOrganization();

  useEffect(() => {
    const fetchEvents = async () => {
      if (!activeOrganization?.id) {
        return;
      }

      try {
        setLoading(true);

        // Fetch all status types from the database
        const [leadStatuses, projectStatuses, sessionStatuses] = await Promise.all([
          supabase
            .from('lead_statuses')
            .select('id, name, lifecycle')
            .eq('organization_id', activeOrganization.id)
            .order('sort_order'),
          supabase
            .from('project_statuses')
            .select('id, name, lifecycle')
            .eq('organization_id', activeOrganization.id)
            .order('sort_order'),
          supabase
            .from('session_statuses')
            .select('id, name, lifecycle')
            .eq('organization_id', activeOrganization.id)
            .order('sort_order')
        ]);

        const dynamicEvents: WorkflowEvent[] = [];

        // Status Change Events
        if (leadStatuses.data) {
          leadStatuses.data.forEach(status => {
            dynamicEvents.push({
              value: `lead_status_to_${status.id}`,
              label: `Lead Status → ${status.name}`,
              description: `When a lead changes to "${status.name}" status`,
              category: 'Lead Status Changes'
            });
          });
        }

        if (projectStatuses.data) {
          projectStatuses.data.forEach(status => {
            dynamicEvents.push({
              value: `project_status_to_${status.id}`,
              label: `Project Status → ${status.name}`,
              description: `When a project changes to "${status.name}" status`,
              category: 'Project Status Changes'
            });
          });
        }

        if (sessionStatuses.data) {
          sessionStatuses.data.forEach(status => {
            dynamicEvents.push({
              value: `session_status_to_${status.id}`,
              label: `Session Status → ${status.name}`,
              description: `When a session changes to "${status.name}" status`,
              category: 'Session Status Changes'
            });
          });
        }

        // Core Business Events
        const coreEvents: WorkflowEvent[] = [
          {
            value: "lead_created",
            label: "New Lead Added",
            description: "When a new lead is added to the system",
            category: "Lead Events"
          },
          {
            value: "project_created",
            label: "New Project Created",
            description: "When a new project is created",
            category: "Project Events"
          },
          {
            value: "session_scheduled",
            label: "Session Scheduled",
            description: "When a new session is booked",
            category: "Session Events"
          },
          {
            value: "session_rescheduled",
            label: "Session Rescheduled",
            description: "When a session date/time is changed",
            category: "Session Events"
          },
          {
            value: "payment_received",
            label: "Payment Received",
            description: "When a payment is processed and received",
            category: "Payment Events"
          },
          {
            value: "payment_overdue",
            label: "Payment Overdue",
            description: "When a payment becomes overdue",
            category: "Payment Events"
          },
          {
            value: "session_reminder_due",
            label: "Session Reminder Due",
            description: "Send reminders before scheduled sessions",
            category: "Time-Based Events"
          },
          {
            value: "followup_reminder_due",
            label: "Follow-up Reminder Due",
            description: "Send follow-up reminders after specific time periods",
            category: "Time-Based Events"
          }
        ];

        // Combine all events
        setEvents([...coreEvents, ...dynamicEvents]);
      } catch (error) {
        console.error('Error fetching workflow events:', error);
        // Fallback to basic events if database fetch fails
        setEvents([
          {
            value: "lead_created",
            label: "New Lead Added",
            description: "When a new lead is added to the system",
            category: "Lead Events"
          },
          {
            value: "session_scheduled",
            label: "Session Scheduled", 
            description: "When a new session is booked",
            category: "Session Events"
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [activeOrganization?.id]);

  return { events, loading };
}