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
      email_templates: {
        Row: {
          blocks: Json
          category: string | null
          created_at: string
          description: string | null
          id: string
          last_saved_at: string | null
          name: string
          organization_id: string
          preheader: string | null
          published_at: string | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_saved_at?: string | null
          name: string
          organization_id: string
          preheader?: string | null
          published_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_saved_at?: string | null
          name?: string
          organization_id?: string
          preheader?: string | null
          published_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitation_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          invitation_count: number | null
          organization_id: string
          user_id: string
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitation_count?: number | null
          organization_id: string
          user_id: string
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invitation_count?: number | null
          organization_id?: string
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          native_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          native_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          native_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_field_definitions: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          is_required: boolean
          is_system: boolean
          is_visible_in_form: boolean
          is_visible_in_table: boolean
          label: string
          options: Json | null
          organization_id: string
          sort_order: number
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type: string
          id?: string
          is_required?: boolean
          is_system?: boolean
          is_visible_in_form?: boolean
          is_visible_in_table?: boolean
          label: string
          options?: Json | null
          organization_id: string
          sort_order?: number
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_system?: boolean
          is_visible_in_form?: boolean
          is_visible_in_table?: boolean
          label?: string
          options?: Json | null
          organization_id?: string
          sort_order?: number
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: []
      }
      lead_field_values: {
        Row: {
          created_at: string
          field_key: string
          id: string
          lead_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_key: string
          id?: string
          lead_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_key?: string
          id?: string
          lead_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      message_templates: {
        Row: {
          blocks: Json | null
          category: string
          created_at: string
          id: string
          is_active: boolean
          master_content: string
          master_subject: string | null
          name: string
          organization_id: string
          placeholders: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json | null
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          master_content: string
          master_subject?: string | null
          name: string
          organization_id: string
          placeholders?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          master_content?: string
          master_subject?: string | null
          name?: string
          organization_id?: string
          placeholders?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string | null
          email_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          organization_id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          organization_id: string
          sent_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          organization_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          delivery_method: string
          email_id: string | null
          error_message: string | null
          id: string
          max_retries: number
          metadata: Json
          notification_type: string
          organization_id: string
          retry_count: number
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_method?: string
          email_id?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          notification_type: string
          organization_id: string
          retry_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_method?: string
          email_id?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          notification_type?: string
          organization_id?: string
          retry_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          created_at: string
          date_format: string | null
          email: string | null
          id: string
          kanban_show_client_name: boolean | null
          kanban_show_project_name: boolean | null
          kanban_show_project_type: boolean | null
          kanban_show_service_count: boolean | null
          kanban_show_session_count: boolean | null
          kanban_show_todo_progress: boolean | null
          logo_url: string | null
          notification_daily_summary_enabled: boolean | null
          notification_global_enabled: boolean | null
          notification_project_milestone_enabled: boolean | null
          organization_id: string
          phone: string | null
          photography_business_name: string | null
          primary_brand_color: string | null
          show_quick_status_buttons: boolean | null
          social_channels: Json | null
          time_format: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_format?: string | null
          email?: string | null
          id?: string
          kanban_show_client_name?: boolean | null
          kanban_show_project_name?: boolean | null
          kanban_show_project_type?: boolean | null
          kanban_show_service_count?: boolean | null
          kanban_show_session_count?: boolean | null
          kanban_show_todo_progress?: boolean | null
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_global_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          organization_id: string
          phone?: string | null
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean | null
          social_channels?: Json | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_format?: string | null
          email?: string | null
          id?: string
          kanban_show_client_name?: boolean | null
          kanban_show_project_name?: boolean | null
          kanban_show_project_type?: boolean | null
          kanban_show_service_count?: boolean | null
          kanban_show_session_count?: boolean | null
          kanban_show_todo_progress?: boolean | null
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_global_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          organization_id?: string
          phone?: string | null
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean | null
          social_channels?: Json | null
          time_format?: string | null
          timezone?: string | null
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
          base_price: number | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          name: string
          organization_id: string
          previous_status_id: string | null
          project_type_id: string | null
          sort_order: number | null
          status_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          name: string
          organization_id: string
          previous_status_id?: string | null
          project_type_id?: string | null
          sort_order?: number | null
          status_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          name?: string
          organization_id?: string
          previous_status_id?: string | null
          project_type_id?: string | null
          sort_order?: number | null
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
      role_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_system: boolean
          name: string
          permissions: string[]
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_system?: boolean
          name: string
          permissions?: string[]
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name?: string
          permissions?: string[]
          sort_order?: number
        }
        Relationships: []
      }
      scheduled_notifications: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt: string | null
          notification_type: string
          organization_id: string
          retry_count: number | null
          scheduled_for: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt?: string | null
          notification_type: string
          organization_id: string
          retry_count?: number | null
          scheduled_for: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt?: string | null
          notification_type?: string
          organization_id?: string
          retry_count?: number | null
          scheduled_for?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_session_reminders: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          organization_id: string
          processed_at: string | null
          reminder_type: string
          scheduled_for: string
          session_id: string
          status: string
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          processed_at?: string | null
          reminder_type: string
          scheduled_for: string
          session_id: string
          status?: string
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          processed_at?: string | null
          reminder_type?: string
          scheduled_for?: string
          session_id?: string
          status?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_scheduled_session_reminders_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_scheduled_session_reminders_session_id"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_scheduled_session_reminders_workflow_id"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
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
          id: string
          lead_id: string
          location: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          session_date: string
          session_name: string | null
          session_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          location?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          session_date: string
          session_name?: string | null
          session_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          location?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          session_date?: string
          session_name?: string | null
          session_time?: string
          status?: string
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
      silent_hours_config: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          end_time: string
          id: string
          organization_id: string
          start_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          organization_id: string
          start_time?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          end_time?: string
          id?: string
          organization_id?: string
          start_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_assets: {
        Row: {
          alt_text: string | null
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          organization_id: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          organization_id: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          alt_text?: string | null
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          organization_id?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_channel_views: {
        Row: {
          channel: string
          content: string | null
          created_at: string
          html_content: string | null
          id: string
          metadata: Json | null
          subject: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          content?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          metadata?: Json | null
          subject?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_channel_views_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_image_usage: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          total_images: number | null
          total_storage_bytes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          total_images?: number | null
          total_storage_bytes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          total_images?: number | null
          total_storage_bytes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_image_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
      translation_keys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key_name: string
          namespace_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key_name: string
          namespace_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key_name?: string
          namespace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_keys_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "translation_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_namespaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          is_approved: boolean
          key_id: string
          language_code: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_approved?: boolean
          key_id: string
          language_code: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_approved?: boolean
          key_id?: string
          language_code?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translations_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      user_column_preferences: {
        Row: {
          column_config: Json
          created_at: string
          id: string
          table_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_config?: Json
          created_at?: string
          id?: string
          table_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_config?: Json
          created_at?: string
          id?: string
          table_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_language_preferences: {
        Row: {
          created_at: string
          id: string
          language_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_language_preferences_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          current_onboarding_step: number | null
          date_format: string | null
          id: string
          logo_url: string | null
          notification_daily_summary_enabled: boolean | null
          notification_global_enabled: boolean | null
          notification_project_milestone_enabled: boolean | null
          notification_scheduled_time: string | null
          onboarding_stage: Database["public"]["Enums"]["onboarding_stage"]
          photography_business_name: string | null
          primary_brand_color: string | null
          show_quick_status_buttons: boolean
          updated_at: string
          user_id: string
          welcome_modal_shown: boolean
        }
        Insert: {
          created_at?: string
          current_onboarding_step?: number | null
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_global_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean
          updated_at?: string
          user_id: string
          welcome_modal_shown?: boolean
        }
        Update: {
          created_at?: string
          current_onboarding_step?: number | null
          date_format?: string | null
          id?: string
          logo_url?: string | null
          notification_daily_summary_enabled?: boolean | null
          notification_global_enabled?: boolean | null
          notification_project_milestone_enabled?: boolean | null
          notification_scheduled_time?: string | null
          onboarding_stage?: Database["public"]["Enums"]["onboarding_stage"]
          photography_business_name?: string | null
          primary_brand_color?: string | null
          show_quick_status_buttons?: boolean
          updated_at?: string
          user_id?: string
          welcome_modal_shown?: boolean
        }
        Relationships: []
      }
      workflow_execution_metrics: {
        Row: {
          average_execution_time_ms: number | null
          created_at: string | null
          date: string
          failed_executions: number | null
          id: string
          organization_id: string
          successful_executions: number | null
          total_executions: number | null
          updated_at: string | null
        }
        Insert: {
          average_execution_time_ms?: number | null
          created_at?: string | null
          date?: string
          failed_executions?: number | null
          id?: string
          organization_id: string
          successful_executions?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Update: {
          average_execution_time_ms?: number | null
          created_at?: string | null
          date?: string
          failed_executions?: number | null
          id?: string
          organization_id?: string
          successful_executions?: number | null
          total_executions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_log: Json | null
          id: string
          started_at: string | null
          status: string
          trigger_entity_id: string
          trigger_entity_type: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          trigger_entity_id: string
          trigger_entity_type: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          trigger_entity_id?: string
          trigger_entity_type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          action_config: Json
          action_type: string
          conditions: Json | null
          created_at: string
          delay_minutes: number | null
          id: string
          is_active: boolean
          step_order: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean
          step_order?: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean
          step_order?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          trigger_conditions?: Json | null
          trigger_type?: string
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
      check_invitation_rate_limit: {
        Args: { org_id: string; user_uuid: string }
        Returns: boolean
      }
      cleanup_conflicting_reminders: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_notifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_onboarding_columns_v3: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      cleanup_old_session_reminders: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_orphaned_channel_views: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_workflow_executions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      debug_get_session_for_reminder: {
        Args: { reminder_id_param: string }
        Returns: Json
      }
      ensure_default_lead_field_definitions: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_lead_statuses_for_org: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_message_templates: {
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
      ensure_default_session_reminder_workflows: {
        Args: { org_id: string; user_uuid: string }
        Returns: undefined
      }
      ensure_default_session_statuses: {
        Args: { user_uuid: string }
        Returns: undefined
      }
      ensure_lead_status_field: {
        Args: { org_id: string }
        Returns: undefined
      }
      ensure_organization_settings: {
        Args:
          | { detected_timezone?: string; org_id: string }
          | { org_id: string }
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
      get_onboarding_performance_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_steps_completed: number
          completed_onboarding: number
          in_progress: number
          not_started: number
          total_users: number
        }[]
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
      get_user_permissions: {
        Args:
          | Record<PropertyKey, never>
          | { org_id?: string; user_uuid?: string }
          | { user_uuid: string }
        Returns: string[]
      }
      get_user_roles: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_workflow_execution_fingerprint: {
        Args: {
          trigger_data_param?: Json
          trigger_entity_id_param: string
          trigger_entity_type_param: string
          workflow_id_param: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          role_name: Database["public"]["Enums"]["app_role"]
          user_uuid: string
        }
        Returns: boolean
      }
      initialize_all_organization_field_definitions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      log_invitation_attempt: {
        Args: {
          email_param: string
          error_message?: string
          org_id: string
          success: boolean
          user_uuid: string
        }
        Returns: undefined
      }
      migrate_existing_lead_data: {
        Args: { org_id: string }
        Returns: undefined
      }
      retry_failed_notifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      safe_user_has_permission: {
        Args: { permission_name: string; user_uuid: string }
        Returns: boolean
      }
      schedule_session_reminders: {
        Args: { session_id_param: string }
        Returns: undefined
      }
      sync_lead_status_options: {
        Args: { org_id: string }
        Returns: undefined
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
      user_is_organization_owner: {
        Args: { org_id: string }
        Returns: boolean
      }
      validate_invitation_email: {
        Args: { email_param: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "support" | "user"
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
      onboarding_stage: "not_started" | "in_progress" | "completed" | "skipped"
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
      app_role: ["admin", "support", "user"],
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
      onboarding_stage: ["not_started", "in_progress", "completed", "skipped"],
      system_role: ["Owner", "Member"],
    },
  },
} as const
