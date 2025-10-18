import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  onClear?: () => void;
  className?: string;
  clearAriaLabel: string;
  renderTrailing?: (props: { loading: boolean }) => ReactNode;
}

export function TableSearchInput({
  value,
  onChange,
  placeholder,
  loading = false,
  onClear,
  className,
  clearAriaLabel,
  renderTrailing,
}: TableSearchInputProps) {
  const canClear = value.trim().length > 0;

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "pl-9 pr-3",
          (loading || (onClear && canClear) || renderTrailing) && "pr-10"
        )}
        aria-label={placeholder}
      />
      {renderTrailing?.({ loading })}
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-[1.5px] border-muted-foreground/40 border-t-primary" />
      )}
      {!loading && onClear && canClear && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClear}
          aria-label={clearAriaLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
