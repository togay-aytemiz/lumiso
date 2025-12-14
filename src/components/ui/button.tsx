import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const surfaceActionButtonClass = "btn-surface-action"

const buttonColorSchemes = {
  amber: {
    base: "border border-amber-300 bg-amber-100 text-amber-900",
    hover: "hover:bg-amber-200",
    focus: "focus-visible:ring-amber-300/60",
  },
  emerald: {
    base: "border border-emerald-300 bg-emerald-100 text-emerald-900",
    hover: "hover:bg-emerald-200",
    focus: "focus-visible:ring-emerald-300/60",
  },
  blue: {
    base: "border border-sky-300 bg-sky-100 text-sky-900",
    hover: "hover:bg-sky-200",
    focus: "focus-visible:ring-sky-300/60",
  },
  slate: {
    base: "border border-slate-300 bg-slate-100 text-slate-900",
    hover: "hover:bg-slate-200",
    focus: "focus-visible:ring-slate-300/60",
  },
  rose: {
    base: "border border-rose-300 bg-rose-100 text-rose-900",
    hover: "hover:bg-rose-200",
    focus: "focus-visible:ring-rose-300/60",
  },
} as const

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        tinted:
          "border border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        link: "text-accent underline-offset-4 hover:underline",
        textAccent:
          "touch-target-compact bg-transparent text-accent hover:bg-transparent hover:underline hover:underline-offset-4 hover:decoration-current h-auto p-0",
        textGhost:
          "touch-target-compact bg-transparent text-muted-foreground hover:bg-transparent hover:underline hover:underline-offset-4 hover:decoration-current h-auto p-0",
        cta: "bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-6 rounded-md border border-input shadow-sm transition-colors",
        dangerOutline: "border border-destructive text-destructive hover:bg-destructive/10",
        chip:
          "bg-transparent text-current hover:bg-transparent hover:text-current shadow-none",
        surface: surfaceActionButtonClass,
        pill: surfaceActionButtonClass,
        pillDanger:
          "rounded-2xl border border-transparent bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/20 hover:text-destructive",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-8 w-8 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  colorScheme?: keyof typeof buttonColorSchemes
  touchTarget?: "default" | "compact"
}

type ButtonComponent = React.ForwardRefExoticComponent<
  ButtonProps & React.RefAttributes<HTMLButtonElement>
> & {
  variants: typeof buttonVariants
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, colorScheme, asChild = false, touchTarget, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const tintClasses =
      variant === "tinted" && colorScheme
        ? buttonColorSchemes[colorScheme]
        : undefined

    // Add compact touch target for dense controls to prevent 44px min-height on mobile
    const isTextVariant = variant === "textAccent" || variant === "textGhost"
    const isDenseSize = size === "sm" || size === "icon"
    const shouldUseCompactTouchTarget =
      touchTarget === "compact" ||
      (!touchTarget && (isTextVariant || variant === "link" || isDenseSize))

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          tintClasses?.base,
          tintClasses?.hover,
          tintClasses?.focus,
          className
        )}
        ref={ref}
        data-touch-target={shouldUseCompactTouchTarget ? "compact" : undefined}
        {...props}
      />
    )
  }
) as ButtonComponent
Button.displayName = "Button"
Button.variants = buttonVariants

export { Button }
