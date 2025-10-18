import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdvancedDataTablePagination } from "./AdvancedDataTable";
import { cn } from "@/lib/utils";

interface AdvancedDataTablePaginationProps {
  pagination: AdvancedDataTablePagination;
  paginationInfo: { start: number; end: number; total: number } | null;
  className?: string;
}

export function AdvancedDataTablePaginationFooter({
  pagination,
  paginationInfo,
  className,
}: AdvancedDataTablePaginationProps) {
  const { t } = useTranslation("common");
  const totalPages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <span className="text-sm text-muted-foreground">
        {pagination.summaryFormatter
          ? pagination.summaryFormatter(paginationInfo!)
          : t("table.paginationSummary", paginationInfo ?? { start: 0, end: 0, total: 0 })}
      </span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {pagination.onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("table.rowsPerPage")}
            </span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => pagination.onPageSizeChange?.(Number(value))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
          >
            {t("table.previousPage")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("table.pageIndicator", {
              page: pagination.page,
              pages: totalPages,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              pagination.onPageChange(Math.min(totalPages, pagination.page + 1))
            }
            disabled={pagination.page >= totalPages}
          >
            {t("table.nextPage")}
          </Button>
        </div>
      </div>
    </div>
  );
}

