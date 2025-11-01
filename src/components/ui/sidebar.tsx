import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslation } from "react-i18next"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

type SidebarMenuHoverContextValue = {
  hoveringMenuId: string | null
  setHoveringMenuId: (id: string | null) => void
}

const SidebarMenuHoverContext = React.createContext<
  SidebarMenuHoverContextValue | null
>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)
    const [hoveringMenuId, setHoveringMenuId] = React.useState<string | null>(
      null
    )

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    const hoverContextValue = React.useMemo<SidebarMenuHoverContextValue>(
      () => ({ hoveringMenuId, setHoveringMenuId }),
      [hoveringMenuId]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <SidebarMenuHoverContext.Provider value={hoverContextValue}>
          <TooltipProvider delayDuration={0}>
            <div
              style={
                {
                  "--sidebar-width": SIDEBAR_WIDTH,
                  "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                  ...style,
                } as React.CSSProperties
              }
              className={cn(
                "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
                className
              )}
              ref={ref}
              {...props}
            >
              {children}
            </div>
          </TooltipProvider>
        </SidebarMenuHoverContext.Provider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]"
          )}
        />
        <div
          className={cn(
            "duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            // Adjust the padding for floating and inset variants.
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  const { t } = useTranslation("common")

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">{t("sidebar.toggle")}</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()
  const { t } = useTranslation("common")

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label={t("sidebar.toggle")}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={t("sidebar.toggle")}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

type SidebarMenuHighlightMode = "active" | "hover"

interface SidebarMenuHighlightContextValue {
  setActive: (node: HTMLElement | null) => void
  unsetActive: (node: HTMLElement | null) => void
  setHover: (node: HTMLElement | null) => void
  clearHover: (node: HTMLElement | null) => void
  unregister: (node: HTMLElement | null) => void
}

const SidebarMenuHighlightContext =
  React.createContext<SidebarMenuHighlightContextValue | null>(null)

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, children, ...props }, ref) => {
  const menuRef = React.useRef<HTMLUListElement | null>(null)
  const activeNodeRef = React.useRef<HTMLElement | null>(null)
  const hoverNodeRef = React.useRef<HTMLElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const hoverContext = React.useContext(SidebarMenuHoverContext)
  const menuId = React.useId()
  const [indicator, setIndicator] = React.useState<{
    x: number
    y: number
    width: number
    height: number
    borderRadius: string
    opacity: number
    mode: SidebarMenuHighlightMode
  }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    borderRadius: "0px",
    opacity: 0,
    mode: "active",
  })

  const applyIndicator = React.useCallback(
    (node: HTMLElement, mode: SidebarMenuHighlightMode) => {
      if (!menuRef.current) return

      const menuRect = menuRef.current.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const styles = window.getComputedStyle(node)

      setIndicator({
        x: nodeRect.left - menuRect.left + menuRef.current.scrollLeft,
        y: nodeRect.top - menuRect.top + menuRef.current.scrollTop,
        width: nodeRect.width,
        height: nodeRect.height,
        borderRadius: styles.borderRadius,
        opacity: mode === "hover" ? 0.92 : 1,
        mode,
      })
    },
    []
  )

  const scheduleIndicator = React.useCallback(
    (node: HTMLElement, mode: SidebarMenuHighlightMode) => {
      if (!menuRef.current) return
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = window.requestAnimationFrame(() => {
        applyIndicator(node, mode)
      })
    },
    [applyIndicator]
  )

  const resetIndicator = React.useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIndicator((prev) => ({
      ...prev,
      opacity: 0,
    }))
  }, [])

  const setActive = React.useCallback(
    (node: HTMLElement | null) => {
      activeNodeRef.current = node
      if (!node) {
        if (!hoverNodeRef.current) {
          resetIndicator()
        }
        return
      }
      if (hoverNodeRef.current && hoverNodeRef.current !== node) {
        return
      }
      if (
        hoverContext?.hoveringMenuId &&
        hoverContext.hoveringMenuId !== menuId
      ) {
        return
      }
      scheduleIndicator(node, "active")
    },
    [hoverContext?.hoveringMenuId, menuId, resetIndicator, scheduleIndicator]
  )

  const unsetActive = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      if (activeNodeRef.current !== node) return
      activeNodeRef.current = null
      if (hoverNodeRef.current) {
        scheduleIndicator(
          hoverNodeRef.current,
          hoverNodeRef.current === node ? "active" : "hover"
        )
      } else {
        resetIndicator()
      }
    },
    [resetIndicator, scheduleIndicator]
  )

  const setHover = React.useCallback(
    (node: HTMLElement | null) => {
      hoverNodeRef.current = node
      if (!node) {
        if (activeNodeRef.current) {
          scheduleIndicator(activeNodeRef.current, "active")
        } else {
          resetIndicator()
        }
        if (hoverContext?.hoveringMenuId === menuId) {
          hoverContext.setHoveringMenuId(null)
        }
        return
      }
      hoverContext?.setHoveringMenuId(menuId)
      const mode =
        activeNodeRef.current && activeNodeRef.current === node
          ? "active"
          : "hover"
      scheduleIndicator(node, mode)
    },
    [hoverContext, menuId, resetIndicator, scheduleIndicator]
  )

  const clearHover = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      if (hoverNodeRef.current !== node) return
      hoverNodeRef.current = null
      if (hoverContext?.hoveringMenuId === menuId) {
        hoverContext.setHoveringMenuId(null)
      }
      if (activeNodeRef.current) {
        scheduleIndicator(activeNodeRef.current, "active")
      } else {
        resetIndicator()
      }
    },
    [hoverContext, menuId, resetIndicator, scheduleIndicator]
  )

  const unregister = React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      if (hoverNodeRef.current === node) {
        hoverNodeRef.current = null
      }
      if (activeNodeRef.current === node) {
        activeNodeRef.current = null
        if (hoverNodeRef.current) {
          scheduleIndicator(
            hoverNodeRef.current,
            hoverNodeRef.current === node ? "active" : "hover"
          )
        } else {
          resetIndicator()
        }
      }
      if (hoverContext?.hoveringMenuId === menuId) {
        hoverContext.setHoveringMenuId(null)
      }
    },
    [hoverContext, menuId, resetIndicator, scheduleIndicator]
  )

  React.useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return

    const handleResize = () => {
      const target = hoverNodeRef.current ?? activeNodeRef.current
      if (target && menuRef.current) {
        scheduleIndicator(
          target,
          target === activeNodeRef.current ? "active" : "hover"
        )
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [scheduleIndicator])

  React.useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      const target = hoverNodeRef.current ?? activeNodeRef.current
      if (target) {
        scheduleIndicator(
          target,
          target === activeNodeRef.current ? "active" : "hover"
        )
      }
    })

    observer.observe(menu)
    return () => {
      observer.disconnect()
    }
  }, [scheduleIndicator])

  React.useEffect(() => {
    if (!hoverContext) return
    if (
      hoverContext.hoveringMenuId &&
      hoverContext.hoveringMenuId !== menuId &&
      !hoverNodeRef.current
    ) {
      resetIndicator()
      return
    }
    if (
      (!hoverContext.hoveringMenuId ||
        hoverContext.hoveringMenuId === menuId) &&
      !hoverNodeRef.current &&
      activeNodeRef.current
    ) {
      scheduleIndicator(activeNodeRef.current, "active")
    }
  }, [hoverContext, menuId, resetIndicator, scheduleIndicator])

  const setMenuRef = React.useCallback(
    (node: HTMLUListElement | null) => {
      menuRef.current = node
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLUListElement | null>).current = node
      }
    },
    [ref]
  )

  const contextValue = React.useMemo<SidebarMenuHighlightContextValue>(
    () => ({
      setActive,
      unsetActive,
      setHover,
      clearHover,
      unregister,
    }),
    [clearHover, setActive, setHover, unregister, unsetActive]
  )

  const handleMenuPointerLeave = React.useCallback(() => {
    if (hoverNodeRef.current) {
      setHover(null)
      return
    }

    if (!hoverContext) {
      return
    }

    if (hoverContext.hoveringMenuId !== menuId) {
      return
    }

    hoverContext.setHoveringMenuId(null)
    if (activeNodeRef.current) {
      scheduleIndicator(activeNodeRef.current, "active")
    } else {
      resetIndicator()
    }
  }, [
    hoverContext,
    menuId,
    resetIndicator,
    scheduleIndicator,
    setHover,
  ])

  return (
    <SidebarMenuHighlightContext.Provider value={contextValue}>
      <ul
        ref={setMenuRef}
        data-sidebar="menu"
        className={cn(
          "relative flex w-full min-w-0 flex-col gap-1",
          className
        )}
        onPointerLeave={handleMenuPointerLeave}
        {...props}
      >
        <li
          aria-hidden="true"
          data-sidebar="menu-highlight"
          className="pointer-events-none absolute left-0 top-0 z-0 list-none border border-[hsl(var(--accent-200))] bg-[linear-gradient(135deg,_hsl(var(--accent-100)),_hsl(var(--accent-300)))] shadow-[0_20px_36px_-26px_hsl(var(--accent-400)_/_0.85)] transition-[opacity,transform,width,height] duration-300 ease-out will-change-transform data-[mode=hover]:border-[hsl(var(--accent-300))] data-[mode=hover]:shadow-[0_24px_40px_-24px_hsl(var(--accent-400)_/_0.92)] data-[mode=active]:border-[hsl(var(--accent-300))] data-[mode=active]:shadow-[0_24px_40px_-24px_hsl(var(--accent-400)_/_0.92)]"
          data-mode={indicator.mode}
          style={{
            transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            width: indicator.width ? `${indicator.width}px` : 0,
            height: indicator.height ? `${indicator.height}px` : 0,
            borderRadius: indicator.borderRadius,
            opacity: indicator.opacity,
          }}
        />
        {children}
      </ul>
    </SidebarMenuHighlightContext.Provider>
  )
})
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative z-10", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button relative z-[1] isolate flex w-full items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-left text-sm font-medium text-sidebar-foreground/85 outline-none ring-sidebar-ring transition-all duration-300 ease-out hover:translate-x-[4px] hover:text-sidebar-accent-foreground focus-visible:translate-x-[4px] focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[hsl(var(--accent-300))] active:translate-x-[2px] disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-9 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-semibold data-[active=true]:text-[hsl(var(--accent-900))] data-[state=open]:text-[hsl(var(--accent-900))] group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:transition-colors",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))] data-[active=true]:shadow-[0_0_0_1px_hsl(var(--accent-300))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state } = useSidebar()
    const highlight = React.useContext(SidebarMenuHighlightContext)
    const localRef =
      React.useRef<HTMLButtonElement | HTMLAnchorElement | null>(null)
    const lastAssignedRef = React.useRef<HTMLElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLElement | null) => {
        localRef.current = node as HTMLButtonElement | HTMLAnchorElement | null
        if (node) {
          lastAssignedRef.current = node
        }

        if (typeof ref === "function") {
          ref(node as HTMLButtonElement | null)
        } else if (ref) {
          ;(ref as React.MutableRefObject<HTMLButtonElement | null>).current =
            node as HTMLButtonElement | null
        }
      },
      [ref]
    )

    React.useLayoutEffect(() => {
      if (!highlight) return
      const node = localRef.current as unknown as HTMLElement | null
      if (!node) return

      if (isActive) {
        highlight.setActive(node)
        return () => {
          highlight.unsetActive(node)
        }
      }

      highlight.unsetActive(node)
    }, [highlight, isActive])

    React.useEffect(() => {
      if (!highlight) return
      const node = lastAssignedRef.current
      if (!node) return

      return () => {
        highlight.unregister(node)
      }
    }, [highlight])

    const handleMouseEnter = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        onMouseEnter?.(event as React.MouseEvent<HTMLButtonElement>)
        if (highlight && localRef.current) {
          highlight.setHover(localRef.current as unknown as HTMLElement)
        }
      },
      [highlight, onMouseEnter]
    )

    const handleMouseLeave = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        onMouseLeave?.(event as React.MouseEvent<HTMLButtonElement>)
        if (highlight && localRef.current) {
          highlight.clearHover(localRef.current as unknown as HTMLElement)
        }
      },
      [highlight, onMouseLeave]
    )

    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLElement>) => {
        onFocus?.(event as React.FocusEvent<HTMLButtonElement>)
        if (highlight && localRef.current) {
          highlight.setHover(localRef.current as unknown as HTMLElement)
        }
      },
      [highlight, onFocus]
    )

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLElement>) => {
        onBlur?.(event as React.FocusEvent<HTMLButtonElement>)
        if (highlight && localRef.current) {
          highlight.clearHover(localRef.current as unknown as HTMLElement)
        }
      },
      [highlight, onBlur]
    )

    const button = (
      <Comp
        ref={setRefs}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("rounded-md h-8 flex gap-2 px-2 items-center", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 flex-1 max-w-[--skeleton-width]"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
