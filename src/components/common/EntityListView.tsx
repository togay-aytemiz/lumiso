import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { PageHeader, PageHeaderSearch } from '@/components/ui/page-header';
import GlobalSearch from '@/components/GlobalSearch';

interface EntityListViewProps<T> {
  title: string;
  subtitle: string;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  onAddClick?: () => void;
  addButtonText?: string;
  emptyState?: React.ReactNode;
  headerActions?: React.ReactNode;
  filters?: React.ReactNode;
  itemsPerPage?: number;
}

export function EntityListView<T>({
  title,
  subtitle,
  data,
  columns,
  loading = false,
  onRowClick,
  onAddClick,
  addButtonText = 'Add Item',
  emptyState,
  headerActions,
  filters,
  itemsPerPage = 20
}: EntityListViewProps<T>) {
  const defaultEmptyState = (
    <div className="text-center py-8 text-muted-foreground">
      No items found. Add your first item to get started!
    </div>
  );

  return (
    <div className="min-h-screen">
      <PageHeader title={title} subtitle={subtitle}>
        <PageHeaderSearch>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            {onAddClick && (
              <Button 
                size="sm"
                onClick={onAddClick}
                className="h-10 flex items-center gap-2 whitespace-nowrap flex-shrink-0 px-3 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{addButtonText}</span>
              </Button>
            )}
            {headerActions}
          </div>
        </PageHeaderSearch>
      </PageHeader>
      
      <div className="p-4 sm:p-6">
        <Card className="min-w-0">
          {filters && (
            <CardHeader>
              {filters}
            </CardHeader>
          )}
          <CardContent className="p-0">
            <DataTable
              data={data}
              columns={columns}
              onRowClick={onRowClick}
              emptyState={emptyState || defaultEmptyState}
              itemsPerPage={itemsPerPage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}