import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTableContainer } from "@/components/ui/data-table-container";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, Filter, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableLoadingSkeleton } from "@/components/ui/loading-presets";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdvancedTableSearch } from "./useAdvancedTableSearch";
import { AdvancedDataTablePaginationFooter } from "./AdvancedDataTablePagination";

const ROW_CLICK_IGNORE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[data-row-click='ignore']",
].join(",");

function shouldIgnoreRowClick(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(ROW_CLICK_IGNORE_SELECTOR));
}

export type SortDirection = "asc" | "desc";

export interface AdvancedTableColumn<T> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  accessorKey?: keyof T | string;
  accessor?: (row: T) => ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortId?: string;
  hideable?: boolean;
  defaultVisible?: boolean;
  align?: "left" | "center" | "right";
  minWidth?: string;
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface AdvancedDataTableSortState {
  columnId: string | null;
  direction: SortDirection;
}

export interface AdvancedDataTablePagination {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  summaryFormatter?: (info: { start: number; end: number; total: number }) => ReactNode;
}

export interface HeaderSummaryChip {
  id: string | number;
  label: ReactNode;
}

export interface AdvancedDataTableHeaderSummary {
  text?: ReactNode;
  chips?: HeaderSummaryChip[];
}

export interface AdvancedDataTableFiltersConfig {
  content: ReactNode;
  title?: ReactNode;
  triggerLabel?: ReactNode;
  footer?: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  collapsedByDefault?: boolean;
}

export interface AdvancedDataTableProps<T> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  summary?: AdvancedDataTableHeaderSummary;
  filters?: AdvancedDataTableFiltersConfig;
  data: T[];
  columns: AdvancedTableColumn<T>[];
  rowKey: (row: T) => string | number;
  zebra?: boolean;
  isLoading?: boolean;
  loadingState?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string | undefined;
  rowActions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  sortState?: AdvancedDataTableSortState;
  onSortChange?: (next: AdvancedDataTableSortState) => void;
  pagination?: AdvancedDataTablePagination;
  searchPlaceholder?: string;
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchChange?: (value: string) => void;
  searchDelay?: number;
  searchMinChars?: number;
  searchLoading?: boolean;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMoreOffset?: number;
  variant?: "card" | "plain";
}

function getNestedValue(
  obj: unknown,
  path: string | undefined
): unknown {
  if (!path || obj === null || typeof obj !== "object") {
    return undefined;
  }
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function AdvancedDataTable<T>({
  title,
  description,
  actions,
  toolbar,
  summary,
  filters,
  data,
  columns,
  rowKey,
  zebra = true,
  isLoading,
  loadingState,
  onRowClick,
  rowClassName,
  rowActions,
  emptyState,
  sortState,
  onSortChange,
  pagination,
  searchPlaceholder,
  searchValue,
  defaultSearchValue,
  onSearchChange,
  searchDelay = 300,
  searchMinChars = 0,
  searchLoading = false,
  className,
  onLoadMore,
  hasMore,
  isLoadingMore,
  loadMoreOffset,
  variant = "card",
}: AdvancedDataTableProps<T>) {
  const { t } = useTranslation("common");
  const isMobile = useIsMobile();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [internalSort, setInternalSort] = useState<AdvancedDataTableSortState>(
    {
      columnId: sortState?.columnId ?? null,
      direction: sortState?.direction ?? "asc",
    }
  );

  const resolvedSort = sortState ?? internalSort;

  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(() =>
    filters ? !filters.collapsedByDefault : false
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const userToggledDesktopFiltersRef = useRef(false);

  const {
    searchInputValue,
    handleSearchInputChange,
    clearSearch,
    canClearSearch,
  } = useAdvancedTableSearch({
    searchValue,
    defaultSearchValue,
    onSearchChange,
    searchDelay,
    searchMinChars,
  });

  const hasFiltersConfig = Boolean(filters);
  const activeFiltersCount = Number(filters?.activeCount ?? 0);
  const collapsedByDefault = Boolean(filters?.collapsedByDefault);

  useEffect(() => {
    if (!hasFiltersConfig) {
      if (desktopFiltersOpen) setDesktopFiltersOpen(false);
      userToggledDesktopFiltersRef.current = false;
      return;
    }

    if (userToggledDesktopFiltersRef.current) return;

    let nextOpen = desktopFiltersOpen;
    if (activeFiltersCount > 0 && !desktopFiltersOpen) {
      nextOpen = true;
    } else {
      nextOpen = collapsedByDefault ? false : desktopFiltersOpen || true;
    }

    if (nextOpen !== desktopFiltersOpen) {
      setDesktopFiltersOpen(nextOpen);
    }
  }, [collapsedByDefault, activeFiltersCount, hasFiltersConfig, desktopFiltersOpen]);

  const handleSort = (column: AdvancedTableColumn<T>) => {
    if (!column.sortable) return;
    const sortId = column.sortId ?? column.id;
    const isActive = resolvedSort.columnId === sortId;
    const nextDirection: SortDirection =
      isActive && resolvedSort.direction === "asc" ? "desc" : "asc";

    if (onSortChange) {
      onSortChange({ columnId: sortId, direction: nextDirection });
    }

    if (!sortState) {
      setInternalSort({ columnId: sortId, direction: nextDirection });
    }
  };

  const renderSortIcon = (column: AdvancedTableColumn<T>) => {
    if (!column.sortable) {
      return null;
    }
    const sortId = column.sortId ?? column.id;
    if (resolvedSort.columnId !== sortId) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return resolvedSort.direction === "asc" ? (
      <ArrowUp className="h-4 w-4 text-muted-foreground" />
    ) : (
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
    );
  };

  const paginationInfo = useMemo(() => {
    if (!pagination) return null;
    const { page, pageSize, totalCount } = pagination;
    const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
    return { start, end, total: totalCount };
  }, [pagination]);

  const renderCell = (row: T, column: AdvancedTableColumn<T>) => {
    if (column.render) {
      return column.render(row);
    }
    if (column.accessor) {
      const value = column.accessor(row);
      return value == null || value === "" ? "—" : value;
    }
    if (column.accessorKey) {
      const value = getNestedValue(row, column.accessorKey as string);
      return value == null || value === "" ? "—" : (value as ReactNode);
    }
    const direct = (row as Record<string, unknown>)[column.id as string];
    return direct == null || direct === "" ? "—" : (direct as ReactNode);
  };

  const handleToggleFilters = () => {
    if (!filters) return;
    userToggledDesktopFiltersRef.current = true;
    if (isMobile) {
      setMobileFiltersOpen(true);
      return;
    }
    setDesktopFiltersOpen((prev) => !prev);
  };

  const activeFilterCount =
    filters?.activeCount !== undefined ? Number(filters.activeCount) : 0;
  const hasActiveFilters = activeFilterCount > 0;
  const filterPanelTitle = filters?.title ?? t("table.filters");
  const filterTriggerLabel = filters?.triggerLabel ?? filterPanelTitle;
  const showHeaderSearch = Boolean(onSearchChange);

  // Determine if a summary row will be visible on mobile to tweak spacing
  const mobileSummaryPresent = useMemo(() => {
    const hasChips = Boolean(summary?.chips && summary.chips.length > 0);
    const hasText = Boolean(summary?.text);
    // Only consider mobile here; desktop spacing remains unchanged
    return isMobile && (hasChips || hasText);
  }, [isMobile, summary?.chips, summary?.text]);

  const showClearSearchAction = Boolean(onSearchChange && canClearSearch);
  const showClearFiltersAction = Boolean(filters?.onReset && hasActiveFilters);

  const renderDefaultEmptyState = () => (
    <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
        <Search className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          {t("table.noDataAvailable")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("messages.info.no_data")}
        </p>
      </div>
      {(showClearSearchAction || showClearFiltersAction) && (
        <div className="flex flex-wrap justify-center gap-2">
          {showClearSearchAction && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={clearSearch}
            >
              {t("table.clearSearch")}
            </Button>
          )}
          {showClearFiltersAction && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={() => filters?.onReset?.()}
            >
              {t("table.clearFilters")}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const resolvedEmptyStateContent = emptyState ?? renderDefaultEmptyState();
  const isEmptyState = !isLoading && data.length === 0;
  const showMobileEmptyState = isMobile && isEmptyState;

  const renderSearchInput = () => (
    <div className="relative w-full h-9 sm:max-w-sm md:max-w-md lg:max-w-lg">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={searchInputValue}
        onChange={(event) => handleSearchInputChange(event.target.value)}
        placeholder={searchPlaceholder ?? t("table.searchPlaceholder")}
        className={cn(
          "pl-9 pr-3 h-9 rounded-full",
          (searchLoading || canClearSearch) && "pr-10"
        )}
        aria-label={searchPlaceholder ?? t("table.searchPlaceholder")}
      />
      {searchLoading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-[1.5px] border-muted-foreground/40 border-t-primary" />
      )}
      {!searchLoading && canClearSearch && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={clearSearch}
          aria-label={t("table.clearSearch")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const filterTriggerButton = filters ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleToggleFilters}
      className={cn(
        "flex items-center gap-2",
        isMobile
          ? "w-auto shrink-0 px-3"
          : "w-full grow-0 justify-center sm:w-auto sm:flex-none sm:justify-start"
      )}
    >
      <Filter className="h-4 w-4" />
      <span className="whitespace-nowrap">{filterTriggerLabel}</span>
      <Badge variant="secondary" className="ml-1">
        {activeFilterCount}
      </Badge>
    </Button>
  ) : null;

  const shouldRenderControls = showHeaderSearch || (!isMobile && filters) || actions;

  const loadMoreOffsetPx = loadMoreOffset ?? 320;
  const canLazyLoad = Boolean(onLoadMore) && (hasMore ?? true);

  useEffect(() => {
    if (!canLazyLoad) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (isLoading || isLoadingMore) return;
        onLoadMore?.();
      },
      {
        root: null,
        rootMargin: `${loadMoreOffsetPx}px`,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [canLazyLoad, isLoading, isLoadingMore, loadMoreOffsetPx, onLoadMore]);

  const isPlain = variant === "plain";
  const RootComponent: React.ElementType = isPlain ? "div" : Card;
  const HeaderComponent: React.ElementType = isPlain ? "div" : CardHeader;
  const ContentComponent: React.ElementType = isPlain ? "div" : CardContent;
  const FooterComponent: React.ElementType = isPlain ? "div" : CardFooter;

  return (
    <RootComponent
      className={cn(
        isPlain ? "border-none bg-transparent p-0 shadow-none" : "border border-border/60 shadow-sm",
        !isPlain && isMobile && "mb-5",
        className
      )}
    >
      {(title || description || actions || toolbar || filters || onSearchChange) && (
        <HeaderComponent
          className={cn(
            "space-y-0.5",
            isPlain ? "px-0 pt-0 pb-3" : "px-4 pt-2.5 pb-2 sm:px-6 sm:pt-3 sm:pb-3"
          )}
        >
          {/* Title + controls */}
          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            {(title || description) && (
              <div className="flex items-center justify-between gap-2 lg:items-start lg:gap-3">
                <div className="min-w-0 flex-1">
                  {title && (
                    <CardTitle className="text-base font-semibold leading-tight whitespace-nowrap">
                      {title}
                    </CardTitle>
                  )}
                  {description && (
                    <CardDescription className="text-muted-foreground">
                      {description}
                    </CardDescription>
                  )}
                </div>
                {isMobile && filterTriggerButton ? (
                  <div className="flex shrink-0 items-center">{filterTriggerButton}</div>
                ) : null}
              </div>
            )}

            {shouldRenderControls && (
              <div className="flex w-full sm:w-auto flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:flex-shrink-0">
                {showHeaderSearch && <div className="w-full sm:w-auto">{renderSearchInput()}</div>}
                {(actions || (!isMobile && filters)) && (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                    {!isMobile && filterTriggerButton}
                    {actions && (
                      <div className="flex w-full basis-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        {actions}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {toolbar && (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          )}
          {(() => {
            const hasChips = Boolean(summary?.chips && summary.chips.length > 0);
            const hasText = Boolean(summary?.text);
            const hasActive = activeFilterCount > 0;
            const shouldShow = hasText || hasChips || (filters && hasActive);
            if (!shouldShow) return null;
            return (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-2.5 gap-y-1",
                  isPlain ? "pt-1" : undefined
                )}
              >
                {hasText && (
                  <span className="text-sm text-muted-foreground">{summary!.text}</span>
                )}
                {filters && hasActive && (
                  <>
                    {hasText && (
                      <span className="hidden text-muted-foreground/50 sm:inline">•</span>
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80 sm:text-sm">
                      {t("table.activeFilters", { count: activeFilterCount })}
                    </span>
                  </>
                )}
                {filters?.onReset && hasActive && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-full px-3"
                    onClick={filters.onReset}
                  >
                    {t("table.clearFilters")}
                  </Button>
                )}
                {hasChips && summary!.chips!.map((chip) => (
                  <Badge
                    key={chip.id}
                    variant="secondary"
                    className="bg-secondary/50 px-2.5 py-1 text-xs font-medium tracking-wide text-foreground"
                  >
                    {chip.label}
                  </Badge>
                ))}
              </div>
            );
          })()}
        </HeaderComponent>
      )}

      {filters && isMobile && (
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{filterPanelTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
              {hasActiveFilters && (
                <p className="text-sm text-muted-foreground">
                  {t("table.activeFilters", { count: activeFilterCount })}
                </p>
              )}
              <div className="space-y-4">{filters.content}</div>
            </div>
            <SheetFooter className="mt-8 shrink-0">
              <div className="flex w-full flex-col gap-2">
                {filters.onReset && (
                  <Button type="button" variant="outline" onClick={filters.onReset}>
                    {t("table.clearFilters")}
                  </Button>
                )}
                {filters.footer}
                <Button type="button" onClick={() => setMobileFiltersOpen(false)}>
                  {t("table.closeFilters")}
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      <ContentComponent
        className={cn(
          isPlain ? "px-0 pt-0" : "px-4 md:px-6 pt-2 pb-3 sm:pb-0",
          mobileSummaryPresent ? "mt-0" : "mt-2 sm:mt-1"
        )}
      >
        {isLoading ? (
          loadingState || <TableLoadingSkeleton />
        ) : (
          <div className="flex flex-col lg:flex-row">
            {filters && !isMobile && (
              <div
                className={cn(
                  "hidden flex-shrink-0 transition-[max-width] duration-300 ease-in-out lg:block",
                  desktopFiltersOpen ? "max-w-[18rem] lg:pr-4" : "max-w-0"
                )}
              >
                <aside
                  className={cn(
                    "flex h-full w-[18rem] flex-col border-b border-border/60 bg-muted/20 px-4 py-4 transition-all duration-300 ease-in-out lg:border-b-0",
                    desktopFiltersOpen
                      ? "translate-x-0 opacity-100"
                      : "-translate-x-4 opacity-0 pointer-events-none"
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{filterPanelTitle}</p>
                      {hasActiveFilters && (
                        <p className="text-xs text-muted-foreground">
                          {t("table.activeFilters", { count: activeFilterCount })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {filters.onReset && hasActiveFilters && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground"
                          onClick={filters.onReset}
                        >
                          {t("table.clearFilters")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground"
                        onClick={() => {
                          userToggledDesktopFiltersRef.current = true;
                          setDesktopFiltersOpen(false);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {filters.content}
                  </div>
                  {filters.footer && <div className="mt-6">{filters.footer}</div>}
                </aside>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="rounded-md border border-border/60 bg-background overflow-hidden">
                {showMobileEmptyState ? (
                  <div className="flex min-h-[260px] items-center justify-center bg-muted/10 px-3 py-8 sm:px-6">
                    <div className="w-full max-w-md">{resolvedEmptyStateContent}</div>
                  </div>
                ) : (
                  <DataTableContainer className={cn(isMobile && "hide-scrollbar mobile-scroll-hint")}>
                    <Table className="min-w-full border-separate border-spacing-0 text-sm">
                      <TableHeader>
                        <TableRow className="relative border-b border-border/60 bg-muted/20 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border/80">
                          {columns.map((column) => (
                            <TableHead
                              key={column.id}
                              className={cn(
                                "whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none",
                                column.sortable
                                  ? "cursor-pointer transition-colors hover:bg-muted/40"
                                  : "",
                                column.align === "right" && "text-right",
                                column.align === "center" && "text-center",
                                "border-r border-border/60 first:border-l first:rounded-tl-md last:border-r-0 last:rounded-tr-md",
                                column.headerClassName
                              )}
                              style={{
                                minWidth: column.minWidth,
                                width: column.width,
                              }}
                              onClick={() => handleSort(column)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {column.label}
                                </span>
                                {renderSortIcon(column)}
                              </div>
                            </TableHead>
                          ))}
                          {rowActions && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.length > 0 ? (
                          data.map((row, index) => {
                            const zebraClass =
                              zebra && index % 2 === 1
                                ? "bg-muted/40 dark:bg-muted/70"
                                : "bg-white dark:bg-background";
                            const userRowClass = rowClassName?.(row, index);
                            return (
                                  <TableRow
                                key={rowKey(row)}
                                className={cn(
                                  zebraClass,
                                  "border-b border-border/60 transition-colors",
                                onRowClick
                                    ? "cursor-pointer hover:bg-muted/30 dark:hover:bg-muted/50"
                                    : "hover:bg-muted/20 dark:hover:bg-muted/40",
                                  userRowClass
                                )}
                                onClick={(event) => {
                                  if (!onRowClick || event.defaultPrevented) return;
                                  if (shouldIgnoreRowClick(event.target)) return;
                                  onRowClick(row);
                                }}
                              >
                                {columns.map((column) => (
                                  <TableCell
                                    key={`${column.id}-${rowKey(row)}`}
                                    className={cn(
                                      "align-middle px-4 py-3 text-foreground",
                                      column.align === "right" && "text-right",
                                      column.align === "center" && "text-center",
                                      "border-r border-border/40 first:border-l first:border-border/60 last:border-r-0",
                                      column.cellClassName
                                    )}
                                    style={{
                                      minWidth: column.minWidth,
                                      width: column.width,
                                    }}
                                  >
                                    {renderCell(row, column)}
                                  </TableCell>
                                ))}
                                {rowActions && (
                                  <TableCell className="text-right align-middle">
                                    {rowActions(row)}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={columns.length + (rowActions ? 1 : 0)}
                              className="py-4 text-center text-sm text-muted-foreground sm:py-10"
                            >
                              <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-2 py-4 text-center sm:px-4 sm:py-6">
                                {resolvedEmptyStateContent}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {canLazyLoad && (
                      <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                        {isLoadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <span className="sr-only">Load more</span>
                        )}
                      </div>
                    )}
                  </DataTableContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </ContentComponent>

      {pagination && paginationInfo && (
        <FooterComponent className={cn(isPlain ? "mt-4 p-0" : "p-0")}>
          <AdvancedDataTablePaginationFooter
            pagination={pagination}
            paginationInfo={paginationInfo}
            className="w-full"
          />
        </FooterComponent>
      )}
    </RootComponent>
  );
}
