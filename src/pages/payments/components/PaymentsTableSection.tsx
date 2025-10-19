import { AdvancedDataTable } from "@/components/data-table";
import type {
  AdvancedDataTablePagination,
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
  toolbar: ReactNode;
  actions: ReactNode;
  sortState: AdvancedDataTableSortState;
  onSortChange: (next: AdvancedDataTableSortState) => void;
  pagination: AdvancedDataTablePagination;
  emptyState: ReactNode;
  onRowClick?: (row: Payment) => void;
  isLoading: boolean;
}

export function PaymentsTableSection({
  data,
  columns,
  filters,
  toolbar,
  actions,
  sortState,
  onSortChange,
  pagination,
  emptyState,
  onRowClick,
  isLoading,
  title,
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
      actions={actions}
      columnCustomization={{ storageKey: "payments.table.columns" }}
      sortState={sortState}
      onSortChange={onSortChange}
      pagination={pagination}
      emptyState={emptyState}
      onRowClick={onRowClick}
    />
  );
}
