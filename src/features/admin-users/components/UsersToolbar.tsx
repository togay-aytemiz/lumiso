import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RefreshCcw, FileDown } from "lucide-react";
import { MembershipStatus } from "../types";
import { useTranslation } from "react-i18next";

interface UsersToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: MembershipStatus | "all";
  onStatusFilterChange: (value: MembershipStatus | "all") => void;
  expiringOnly: boolean;
  onExpiringOnlyChange: (value: boolean) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  statusOptions: Array<MembershipStatus | "all">;
}

export function UsersToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  expiringOnly,
  onExpiringOnlyChange,
  onRefresh,
  onExport,
  statusOptions,
}: UsersToolbarProps) {
  const { t } = useTranslation("pages");

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("admin.users.filters.searchPlaceholder")}
          className="w-full sm:max-w-xs"
        />

        <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as MembershipStatus | "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("admin.users.filters.statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status === "all" ? t("admin.users.filters.status.all") : t(`admin.users.status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2">
          <Switch id="expiring-only" checked={expiringOnly} onCheckedChange={onExpiringOnlyChange} />
          <Label htmlFor="expiring-only" className="text-sm">
            {t("admin.users.filters.expiringOnly")}
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRefresh} type="button">
          <RefreshCcw className="mr-2 h-4 w-4" />
          {t("admin.users.actions.refresh")}
        </Button>
        <Button variant="secondary" onClick={onExport} type="button">
          <FileDown className="mr-2 h-4 w-4" />
          {t("admin.users.actions.export")}
        </Button>
      </div>
    </div>
  );
}
