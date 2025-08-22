import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataTable, type Column } from "@/hooks/useDataTable";
import { DataTableContainer } from "./data-table-container";

export type { Column } from "@/hooks/useDataTable";

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  itemsPerPage?: number;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  itemsPerPage = 20,
  emptyState,
  className,
}: DataTableProps<T>) {
  const {
    paginatedData,
    totalItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    sortField,
    sortDirection,
    handleSort,
    handlePageChange,
    getValue,
  } = useDataTable({ data, columns, itemsPerPage });

  const getSortIcon = (columnKey: string) => {
    if (sortField !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className={className}>
      {/* Results info */}
      {totalItems > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {startIndex} to {endIndex} of {totalItems} results
        </div>
      )}

      {/* Table */}
      <DataTableContainer>
        <div className="rounded-md bg-background min-w-max">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    className={cn(
                      "whitespace-nowrap",
                      column.sortable
                        ? "cursor-pointer hover:bg-muted/50 transition-colors"
                        : ""
                    )}
                    onClick={
                      column.sortable
                        ? () => handleSort(String(column.key))
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && getSortIcon(String(column.key))}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, index) => (
                  <TableRow
                    key={index}
                    className={`
                      ${index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                      ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                      transition-colors border-0
                    `}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell 
                        key={String(column.key)}
                        className="whitespace-nowrap"
                      >
                        {column.render
                          ? column.render(item, getValue(item, column))
                          : String(getValue(item, column) || '-')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    {emptyState || (
                      <div className="text-center text-muted-foreground">
                        No data available
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DataTableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => handlePageChange(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}