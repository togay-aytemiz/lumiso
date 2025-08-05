import { useState, useMemo } from "react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T, value: any) => React.ReactNode;
  accessor?: (item: T) => any;
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

  const getValue = (item: T, column: Column<T>) => {
    if (column.accessor) {
      return column.accessor(item);
    }
    if (typeof column.key === 'string' && column.key.includes('.')) {
      const keys = column.key.split('.');
      let value: any = item;
      for (const key of keys) {
        value = value?.[key];
      }
      return value;
    }
    return item[column.key as keyof T];
  };

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
        filtered.sort((a, b) => {
          let aValue = getValue(a, column);
          let bValue = getValue(b, column);

          // Handle dates
          if (aValue instanceof Date && bValue instanceof Date) {
            aValue = aValue.getTime();
            bValue = bValue.getTime();
          } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            // Check if it's a date string
            const aDate = new Date(aValue);
            const bDate = new Date(bValue);
            if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
              aValue = aDate.getTime();
              bValue = bDate.getTime();
            } else {
              aValue = aValue.toLowerCase();
              bValue = bValue.toLowerCase();
            }
          }

          // Handle null/undefined values
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return 1;
          if (bValue == null) return -1;

          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return filtered;
  }, [data, filters, sortField, sortDirection, columns]);

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