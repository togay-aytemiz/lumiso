import { AdvancedDataTable } from "@/components/data-table";
import type {
  AdvancedDataTableSortState,
  AdvancedTableColumn,
  AdvancedDataTableFiltersConfig,
} from "@/components/data-table";
import type { Payment } from "../types";
import type { ReactNode } from "react";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";

interface PaymentsTableSectionProps {
  title: ReactNode;
  data: Payment[];
  columns: AdvancedTableColumn<Payment>[];
  filters: AdvancedDataTableFiltersConfig;
  toolbar?: ReactNode;
  actions: ReactNode;
  summary?: { text?: ReactNode; chips?: { id: string | number; label: ReactNode }[] };
  sortState: AdvancedDataTableSortState;
  onSortChange: (next: AdvancedDataTableSortState) => void;
  emptyState: ReactNode;
  onRowClick?: (row: Payment) => void;
  isLoading: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLoading?: boolean;
  searchMinChars?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function PaymentsTableSection({
  data,
  columns,
  filters,
  toolbar,
  actions,
  summary,
  sortState,
  onSortChange,
  emptyState,
  onRowClick,
  isLoading,
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLoading,
  searchMinChars,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: PaymentsTableSectionProps) {
  return (
    <AdvancedDataTable
      title={title}
      data={data}
      columns={columns}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingState={<TableLoadingSkeleton />}
      zebra
      filters={filters}
      toolbar={toolbar}
      summary={summary}
      actions={actions}
      sortState={sortState}
      onSortChange={onSortChange}
      emptyState={emptyState}
      onRowClick={onRowClick}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchLoading={searchLoading}
      searchMinChars={searchMinChars}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
    />
  );
}
