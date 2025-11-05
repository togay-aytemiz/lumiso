import { useState, useMemo, useCallback } from "react";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type SortableValue = string | number | null | undefined;

const normalizeSortValue = (value: unknown): SortableValue => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
    return value.toLowerCase();
  }

  if (value == null) {
    return value;
  }

  return String(value).toLowerCase();
};

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T, value: unknown) => React.ReactNode;
  accessor?: (item: T) => unknown;
}

export interface UseDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  itemsPerPage?: number;
}

export type SortDirection = 'asc' | 'desc';

export function useDataTable<T>({ data, columns, itemsPerPage = 20 }: UseDataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const getValue = useCallback((item: T, column: Column<T>): unknown => {
    if (column.accessor) {
      return column.accessor(item);
    }
    if (typeof column.key === 'string' && column.key.includes('.')) {
      const keys = column.key.split('.');
      let value: unknown = item;
      for (const key of keys) {
        if (isRecord(value)) {
          value = value[key];
        } else {
          value = undefined;
          break;
        }
      }
      return value;
    }
    return item[column.key as keyof T];
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply filters
    Object.entries(filters).forEach(([columnKey, filterValue]) => {
      if (filterValue.trim()) {
        const column = columns.find(col => col.key === columnKey);
        if (column) {
          filtered = filtered.filter(item => {
            const value = getValue(item, column);
            const stringValue = String(value || '').toLowerCase();
            return stringValue.includes(filterValue.toLowerCase());
          });
        }
      }
    });

    // Apply sorting
    if (sortField) {
      const column = columns.find(col => col.key === sortField);
      if (column) {
        const sorted = [...filtered].sort((a, b) => {
          const aValue = normalizeSortValue(getValue(a, column));
          const bValue = normalizeSortValue(getValue(b, column));

          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return 1;
          if (bValue == null) return -1;

          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
        filtered = sorted;
      }
    }

    return filtered;
  }, [data, filters, sortField, sortDirection, columns, getValue]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilter = (columnKey: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const resetFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  return {
    // Data
    paginatedData,
    filteredAndSortedData,
    totalItems: filteredAndSortedData.length,
    
    // Pagination
    currentPage,
    totalPages,
    itemsPerPage,
    startIndex: startIndex + 1,
    endIndex: Math.min(startIndex + itemsPerPage, filteredAndSortedData.length),
    
    // Sorting
    sortField,
    sortDirection,
    
    // Filtering
    filters,
    
    // Actions
    handleSort,
    handleFilter,
    handlePageChange,
    resetFilters,
    
    // Utilities
    getValue,
  };
}
