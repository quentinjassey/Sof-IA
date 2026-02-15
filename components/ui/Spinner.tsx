import * as React from "react"
import { Loader2 } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
    spinnerColor: {
      primary: "text-primary",
      white: "text-white",
      gray: "text-muted-foreground",
      current: "text-current",
    },
  },
  defaultVariants: {
    size: "md",
    spinnerColor: "primary",
  },
})

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof spinnerVariants> {
  color?: "primary" | "white" | "gray" | "current"
}

function Spinner({ className, size, color, ...props }: SpinnerProps) {
  return (
    <Loader2
      className={cn(spinnerVariants({ size, spinnerColor: color }), className)}
      role="status"
      aria-label="Chargement en cours"
    />
  )
}

export { Spinner, spinnerVariants }
