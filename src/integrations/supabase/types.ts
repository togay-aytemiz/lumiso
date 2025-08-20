export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completed: boolean | null
          content: string
          created_at: string
          google_event_id: string | null
          id: string
          lead_id: string
          organization_id: string | null
          project_id: string | null
          reminder_date: string | null
          reminder_time: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          content: string
          created_at?: string
          google_event_id?: string | null
          id?: string
          lead_id: string
          organization_id?: string | null
          project_id?: string | null
          reminder_date?: string | null
          reminder_time?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          content?: string
          created_at?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string
          organization_id?: string | null
          project_id?: string | null
          reminder_date?: string | null
          reminder_time?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string | null
          scope: string
          token_expiry: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          scope: string
          token_expiry: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string
          token_expiry?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          is_system_final: boolean
          is_system_required: boolean | null
          lifecycle: string | null
          name: string
          organization_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system_final?: boolean
          is_system_required?: boolean | null
          lifecycle?: string | null
          name: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system_final?: boolean
          is_system_required?: boolean | null
          lifecycle?: string | null
          name?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assignees: string[] | null
          created_at: string
          due_date: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          status: string
          status_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignees?: string[] | null
          created_at?: string
          due_date?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: string
          status_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignees?: string[] | null
          created_at?: string
          due_date?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: string
          status_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_status_id"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          custom_role_id: string | null
          id: string
          invited_by: string | null
          joined_at: string
          last_active: string | null
          organization_id: string
          role: string
          status: string
          system_role: Database["public"]["Enums"]["system_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active?: string | null
          organization_id: string
          role: string
          status?: string
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_role_id?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active?: string | null
          organization_id?: string
          role?: string
          status?: string
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          date_format: string | null
          id: string
          logo_url: string | null
          notification_daily_summary_enabled: boolean | null
          notification_daily_summary_send_at: string | null
          notification_global_enabled: boolean | null
          notification_new_assignment_enabled: boolean | null
          notification_project_milestone_enabled: boolean | null
          notification_scheduled_time: string | null
          notification_weekly_recap_enabled: boolean | null
          notification_weekly_recap_send_at: string | null
          organization_id: string
          photography_business_name: string | null
          primary_brand_color: string | null
          show_quick_status_buttons: boolean | null
          time_format: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_daily_summary_send_at?: string | null
          notification_global_enabled?: boolean | null
          notification_new_assignment_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          notification_weekly_recap_enabled?: boolean | null
          notification_weekly_recap_send_at?: string | null
          organization_id: string
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean | null
          time_format?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_daily_summary_send_at?: string | null
          notification_global_enabled?: boolean | null
          notification_new_assignment_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          notification_weekly_recap_enabled?: boolean | null
          notification_weekly_recap_send_at?: string | null
          organization_id?: string
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean | null
          time_format?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          applicable_types: string[] | null
          created_at: string
          default_add_ons: string[] | null
          description: string | null
          duration: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applicable_types?: string[] | null
          created_at?: string
          default_add_ons?: string[] | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          applicable_types?: string[] | null
          created_at?: string
          default_add_ons?: string[] | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          date_paid: string | null
          description: string | null
          id: string
          organization_id: string | null
          project_id: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date_paid?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          project_id: string
          status: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_paid?: string | null
          description?: string | null
          id?: string
          organization_id?: string | null
          project_id?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_number: string | null
          profile_photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_services: {
        Row: {
          created_at: string
          id: string
          project_id: string
          service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_services_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_services_service_id"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      project_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system_required: boolean | null
          lifecycle: string | null
          name: string
          organization_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_system_required?: boolean | null
          lifecycle?: string | null
          name: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system_required?: boolean | null
          lifecycle?: string | null
          name?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_types: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assignees: string[] | null
          base_price: number | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          name: string
          organization_id: string
          previous_status_id: string | null
          project_type_id: string | null
          status_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignees?: string[] | null
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          name: string
          organization_id: string
          previous_status_id?: string | null
          project_type_id?: string | null
          status_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignees?: string[] | null
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          name?: string
          organization_id?: string
          previous_status_id?: string | null
          project_type_id?: string | null
          status_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_project_type"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_previous_status_id_fkey"
            columns: ["previous_status_id"]
            isOneToOne: false
            referencedRelation: "project_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "project_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          extra: boolean | null
          id: string
          is_sample: boolean | null
          name: string
          organization_id: string | null
          price: number | null
          selling_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          extra?: boolean | null
          id?: string
          is_sample?: boolean | null
          name: string
          organization_id?: string | null
          price?: number | null
          selling_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          extra?: boolean | null
          id?: string
          is_sample?: boolean | null
          name?: string
          organization_id?: string | null
          price?: number | null
          selling_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_system_initial: boolean
          is_system_required: boolean | null
          lifecycle: string | null
          name: string
          organization_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_system_initial?: boolean
          is_system_required?: boolean | null
          lifecycle?: string | null
          name: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_system_initial?: boolean
          is_system_required?: boolean | null
          lifecycle?: string | null
          name?: string
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          google_event_id: string | null
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          project_id: string | null
          session_date: string
          session_time: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_event_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          session_date: string
          session_time: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          session_date?: string
          session_time?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sessions_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          content: string
          created_at: string
          id: string
          is_completed: boolean
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_completed?: boolean
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_organization_id: string | null
          created_at: string
          date_format: string | null
          id: string
          logo_url: string | null
          notification_daily_summary_enabled: boolean | null
          notification_daily_summary_send_at: string | null
          notification_global_enabled: boolean | null
          notification_new_assignment_enabled: boolean | null
          notification_project_milestone_enabled: boolean | null
          notification_scheduled_time: string | null
          notification_weekly_recap_enabled: boolean | null
          notification_weekly_recap_send_at: string | null
          photography_business_name: string | null
          primary_brand_color: string | null
          show_quick_status_buttons: boolean
          time_format: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_daily_summary_send_at?: string | null
          notification_global_enabled?: boolean | null
          notification_new_assignment_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          notification_weekly_recap_enabled?: boolean | null
          notification_weekly_recap_send_at?: string | null
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean
          time_format?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_daily_summary_send_at?: string | null
          notification_global_enabled?: boolean | null
          notification_new_assignment_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          notification_weekly_recap_enabled?: boolean | null
          notification_weekly_recap_send_at?: string | null
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean
          time_format?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          created_at: string
          day_of_week: number
          enabled: boolean
          end_time: string | null
          id: string
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          enabled?: boolean
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          end_time?: string | null
          id?: string
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_not_in_any_organization: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      ensure_default_lead_statuses_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_packages: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      ensure_default_packages_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_project_statuses_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_project_types_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_services: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      ensure_default_services_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_session_statuses: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      ensure_organization_settings: {
        Args: { org_id: string }
        Returns: string
      }
      ensure_system_lead_statuses: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      ensure_user_settings: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_default_lead_status: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_default_project_status: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_default_session_status: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_lead_lifecycle: {
        Args: { status_id: string }
        Returns: string
      }
      get_project_lifecycle: {
        Args: { status_id: string }
        Returns: string
      }
      get_session_lifecycle: {
        Args: { status_id: string }
        Returns: string
      }
      get_status_lifecycle: {
        Args: { status_id: string; status_table: string }
        Returns: string
      }
      get_user_active_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_organization_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_organization_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      user_can_access_project: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_has_pending_membership: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { permission_name: string; user_uuid: string }
        Returns: boolean
      }
      user_is_assigned_to_lead: {
        Args: { lead_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_is_assigned_to_project: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_is_organization_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      user_is_organization_owner: {
        Args: { org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "rescheduled"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal_sent"
        | "booked"
        | "completed"
        | "lost"
      session_status:
        | "planned"
        | "completed"
        | "in_post_processing"
        | "delivered"
        | "cancelled"
      system_role: "Owner" | "Member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "rescheduled",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal_sent",
        "booked",
        "completed",
        "lost",
      ],
      session_status: [
        "planned",
        "completed",
        "in_post_processing",
        "delivered",
        "cancelled",
      ],
      system_role: ["Owner", "Member"],
    },
  },
} as const
