export interface ProjectLeadSummary {
  id: string;
  name: string;
  status: string;
  email: string | null;
  phone: string | null;
}

export interface ProjectStatusSummary {
  id: string;
  name: string;
  color: string;
  sort_order?: number;
  lifecycle?: string;
}

export interface ProjectTypeSummary {
  id: string;
  name: string;
}

export interface ProjectServiceSummary {
  id: string;
  name: string;
}

export interface ProjectTodoSummary {
  id: string;
  content: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  lead_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status_id: string | null;
  project_type_id: string | null;
  base_price?: number | null;
  sort_order?: number | null;
  lead: ProjectLeadSummary | null;
  project_status: ProjectStatusSummary | null;
  project_type: ProjectTypeSummary | null;
  session_count?: number;
  upcoming_session_count?: number;
  planned_session_count?: number;
  next_session_date?: string | null;
  todo_count?: number;
  completed_todo_count?: number;
  open_todos?: ProjectTodoSummary[];
  paid_amount?: number | null;
  remaining_amount?: number | null;
  services?: ProjectServiceSummary[];
  assignees?: string[] | null;
}
