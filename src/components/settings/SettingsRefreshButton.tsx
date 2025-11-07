import { useCallback, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsRefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing?: boolean;
  label?: string;
  lastUpdatedAt?: Date | number | null;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export function SettingsRefreshButton({
  onRefresh,
  isRefreshing: externalRefreshing,
  label = "Refresh",
  lastUpdatedAt,
  className,
  variant = "pill",
  size = "sm",
}: SettingsRefreshButtonProps) {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const refreshing = externalRefreshing ?? internalRefreshing;

  const handleClick = useCallback(async () => {
    if (refreshing) return;
    const result = onRefresh?.();
    if (result && typeof result.then === "function") {
      try {
        setInternalRefreshing(true);
        await result;
      } finally {
        setInternalRefreshing(false);
      }
    }
  }, [onRefresh, refreshing]);

  const timestampLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    try {
      return formatDistanceToNowStrict(lastUpdatedAt, { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastUpdatedAt]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={refreshing}
        onClick={handleClick}
        className="flex items-center gap-2"
      >
        <RefreshCcw
          className={cn(
            "h-4 w-4",
            refreshing && "animate-spin"
          )}
        />
        {label}
      </Button>
      {timestampLabel && (
        <span className="text-xs text-muted-foreground">
          Updated {timestampLabel}
        </span>
      )}
    </div>
  );
}
