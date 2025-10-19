import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import type { DateFilterType } from "../types";

interface PaymentsDateControlsProps {
  rangeLabel: string;
  rangeNotice: string;
  selectedFilter: DateFilterType;
  onSelectedFilterChange: (value: DateFilterType) => void;
  customDateRange?: DateRange;
  onCustomDateRangeChange: (range: DateRange | undefined) => void;
}

export function PaymentsDateControls({
  rangeLabel,
  rangeNotice,
  selectedFilter,
  onSelectedFilterChange,
  customDateRange,
  onCustomDateRangeChange,
}: PaymentsDateControlsProps) {
  const { t } = useTranslation("pages");

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      {rangeLabel ? (
        <div className="inline-flex flex-col rounded-md border border-border/60 bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("payments.range.label")}
          </span>
          <span className="text-lg font-semibold text-foreground">
            {rangeLabel}
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">{rangeNotice}</span>
      )}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Select
          value={selectedFilter}
          onValueChange={(value) => onSelectedFilterChange(value as DateFilterType)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("payments.selectPeriod")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last7days">{t("payments.dateFilters.last7days")}</SelectItem>
            <SelectItem value="last4weeks">{t("payments.dateFilters.last4weeks")}</SelectItem>
            <SelectItem value="last3months">{t("payments.dateFilters.last3months")}</SelectItem>
            <SelectItem value="last12months">{t("payments.dateFilters.last12months")}</SelectItem>
            <SelectItem value="monthToDate">{t("payments.dateFilters.monthToDate")}</SelectItem>
            <SelectItem value="quarterToDate">{t("payments.dateFilters.quarterToDate")}</SelectItem>
            <SelectItem value="yearToDate">{t("payments.dateFilters.yearToDate")}</SelectItem>
            <SelectItem value="lastMonth">{t("payments.dateFilters.lastMonth")}</SelectItem>
            <SelectItem value="allTime">{t("payments.dateFilters.allTime")}</SelectItem>
            <SelectItem value="custom">{t("payments.dateFilters.customRange")}</SelectItem>
          </SelectContent>
        </Select>

        {selectedFilter === "custom" && (
          <DateRangePicker
            dateRange={customDateRange}
            onDateRangeChange={onCustomDateRangeChange}
          />
        )}
      </div>
    </div>
  );
}
