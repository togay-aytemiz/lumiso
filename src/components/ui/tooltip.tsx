import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

type TooltipContextValue = {
  isTouch: boolean
  setOpen?: (open: boolean) => void
}

const TooltipTouchContext = React.createContext<TooltipContextValue>({
  isTouch: false
})

const TOUCH_AUTO_CLOSE_MS = 2200

function isLikelyTouchDevice() {
  if (typeof window === "undefined") return false
  const nav = typeof navigator !== "undefined" ? navigator : null
  const hasTouchPoints =
    (nav?.maxTouchPoints ?? 0) > 0 || (nav as unknown as { msMaxTouchPoints?: number })?.msMaxTouchPoints > 0
  const hasTouchEvents = "ontouchstart" in window
  const matchesCoarse =
    typeof matchMedia !== "undefined" &&
    (matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches)

  return hasTouchPoints || hasTouchEvents || matchesCoarse
}

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = React.useState(false)

  React.useEffect(() => {
    const update = () => setIsTouch(isLikelyTouchDevice())

    update()

    if (typeof window === "undefined") {
      return
    }

    const queries =
      typeof matchMedia !== "undefined"
        ? ["(pointer: coarse)", "(hover: none)"].map((q) => matchMedia(q))
        : []

    queries.forEach((mq) => mq.addEventListener("change", update))

    const handlePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        setIsTouch(true)
      }
    }

    window.addEventListener("pointerdown", handlePointer, { passive: true })

    return () => {
      queries.forEach((mq) => mq.removeEventListener("change", update))
      window.removeEventListener("pointerdown", handlePointer)
    }
  }, [])

  return isTouch
}

type TooltipProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>

const Tooltip = ({ delayDuration, disableHoverableContent, open: openProp, defaultOpen, onOpenChange, children, ...props }: TooltipProps) => {
  const isTouch = useIsTouchDevice()
  const [open, setOpen] = React.useState(defaultOpen ?? false)

  // Auto-close touch tooltips after a short time to avoid leaving them stuck open
  React.useEffect(() => {
    if (!isTouch || !open) return
    const timer = window.setTimeout(() => setOpen(false), TOUCH_AUTO_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [isTouch, open])

  const contextValue = React.useMemo(
    () => ({
      isTouch,
      setOpen: isTouch ? setOpen : onOpenChange
    }),
    [isTouch, onOpenChange]
  )

  return (
    <TooltipTouchContext.Provider value={contextValue}>
      <TooltipPrimitive.Root
        open={isTouch ? open : openProp}
        defaultOpen={isTouch ? undefined : defaultOpen}
        onOpenChange={isTouch ? setOpen : onOpenChange}
        delayDuration={isTouch ? 0 : delayDuration}
        disableHoverableContent={isTouch ? true : disableHoverableContent}
        {...props}
      >
        {children}
      </TooltipPrimitive.Root>
    </TooltipTouchContext.Provider>
  )
}

type TooltipTriggerProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  TooltipTriggerProps
>(({ onPointerDown, onTouchStart, onClick, ...props }, ref) => {
  const { isTouch, setOpen } = React.useContext(TooltipTouchContext)

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        if (isTouch && setOpen) {
          setOpen(true)
        }
        onPointerDown?.(event)
      }}
      onTouchStart={(event) => {
        if (isTouch && setOpen) {
          setOpen(true)
        }
        onTouchStart?.(event)
      }}
      onClick={(event) => {
        if (isTouch && setOpen) {
          setOpen(true)
        }
        onClick?.(event)
      }}
      {...props}
    />
  )
})
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      avoidCollisions
      collisionPadding={8}
      className={cn(
        "z-[9999] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
