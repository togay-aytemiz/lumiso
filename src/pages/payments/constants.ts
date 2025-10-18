import type { PaymentStatusFilter, PaymentTypeFilter } from "./types";

export const PAGE_SIZE = 25;

export const PROJECT_SELECT_FIELDS =
  "id, name, base_price, lead_id, status_id, previous_status_id, project_type_id, description, updated_at, created_at, user_id";

export const STATUS_FILTER_OPTIONS: PaymentStatusFilter[] = ["paid", "due"];

export const TYPE_FILTER_OPTIONS: PaymentTypeFilter[] = [
  "base_price",
  "extra",
  "manual",
];

export const SEARCH_MIN_CHARS = 3;

