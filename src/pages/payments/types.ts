export interface Payment {
  id: string;
  amount: number;
  date_paid: string | null;
  status: string;
  description: string | null;
  type: string;
  project_id: string;
  created_at: string;
  projects: {
    id: string;
    name: string;
    base_price: number | null;
    lead_id: string;
    status_id?: string | null;
    previous_status_id?: string | null;
    project_type_id?: string | null;
    description?: string | null;
    updated_at?: string;
    created_at?: string;
    user_id?: string;
    leads: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface PaymentMetrics {
  totalPaid: number;
  totalInvoiced: number;
  remainingBalance: number;
  collectionRate: number;
}

export interface PaymentTrendPoint {
  period: string;
  paid: number;
  due: number;
}

export type TrendGrouping = "day" | "week" | "month";

export type SortField =
  | "date_paid"
  | "amount"
  | "project_name"
  | "lead_name"
  | "description"
  | "status"
  | "type";

export type SortDirection = "asc" | "desc";

export type DateFilterType =
  | "last7days"
  | "last4weeks"
  | "last3months"
  | "last12months"
  | "monthToDate"
  | "quarterToDate"
  | "yearToDate"
  | "lastMonth"
  | "allTime"
  | "custom";

export type PaymentStatusFilter = "paid" | "due";
export type PaymentTypeFilter = "base_price" | "extra" | "manual";

export type ProjectDetails = NonNullable<Payment["projects"]>;

