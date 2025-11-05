import { forwardRef, type KeyboardEventHandler, type MouseEvent as ReactMouseEvent } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectablePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  disableRemoveTooltip?: boolean;
}

export const SelectablePill = forwardRef<HTMLButtonElement, SelectablePillProps>(
  ({ children, className, selected = false, onRemove, removeLabel, onClick, onKeyDown, ...props }, ref) => {
    const handleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(event as unknown as ReactMouseEvent<HTMLButtonElement>);
      }
      onKeyDown?.(event);
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          selected
            ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80"
            : "border-border bg-white text-slate-700 hover:bg-slate-100",
          className
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        {onRemove ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onRemove();
              }
            }}
            aria-label={removeLabel}
            className={cn(
              "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors",
              selected ? "hover:bg-white/30" : "hover:bg-slate-900/10"
            )}
          >
            <Trash2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </span>
        ) : null}
      </button>
    );
  }
);

SelectablePill.displayName = "SelectablePill";
