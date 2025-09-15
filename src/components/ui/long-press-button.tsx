import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LongPressButtonProps extends Omit<ButtonProps, "onClick"> {
  label: string;
  onConfirm: () => void;
  duration?: number; // ms
  holdingLabel?: string; // shown while holding
  completeLabel?: string; // briefly shown when completed
  className?: string;
}

export function LongPressButton({
  label,
  onConfirm,
  duration = 3000,
  holdingLabel = "Keep holding…",
  completeLabel = "Exiting…",
  className,
  disabled,
  variant,
  size,
  ...rest
}: LongPressButtonProps) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [completed, setCompleted] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    rafRef.current = null;
    timeoutRef.current = null;
  }, []);

  const endHold = useCallback((didComplete = false) => {
    clearTimers();
    setHolding(false);
    setProgress(didComplete ? 1 : 0);
    if (didComplete) {
      setCompleted(true);
      // reset visual state after a brief moment
      window.setTimeout(() => {
        setCompleted(false);
        setProgress(0);
      }, 600);
    } else {
      setCompleted(false);
    }
  }, [clearTimers]);

  const startHold = useCallback(() => {
    if (disabled) return;
    setHolding(true);
    setCompleted(false);
    startRef.current = performance.now();

    const step = (now: number) => {
      if (!startRef.current) return;
      const elapsed = now - startRef.current;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    timeoutRef.current = window.setTimeout(() => {
      // confirm
      try {
        onConfirm();
      } finally {
        endHold(true);
      }
    }, duration) as unknown as number;
  }, [disabled, duration, endHold, onConfirm]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const remainingSeconds = Math.max(0, (1 - progress) * (duration / 1000));
  const holdingText = `${holdingLabel} ${remainingSeconds.toFixed(1)}s`;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onMouseDown={startHold}
      onMouseUp={() => endHold(false)}
      onMouseLeave={() => endHold(false)}
      onTouchStart={startHold}
      onTouchEnd={() => endHold(false)}
      onTouchCancel={() => endHold(false)}
      className={cn("relative overflow-hidden", className)}
      {...rest}
    >
      {/* Progress bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-destructive/20"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10">
        {completed ? completeLabel : holding ? holdingText : label}
      </span>
    </Button>
  );
}

export default LongPressButton;
