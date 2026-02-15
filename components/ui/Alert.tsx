import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4",
  {
    variants: {
      variant: {
        info: "bg-primary/5 border-primary/20 text-primary [&>div>div.shrink-0>svg]:text-primary",
        success: "bg-success/5 border-success/20 text-success [&>div>div.shrink-0>svg]:text-success",
        warning: "bg-warning/5 border-warning/20 text-warning-foreground [&>div>div.shrink-0>svg]:text-warning-foreground",
        error: "bg-destructive/5 border-destructive/20 text-destructive [&>div>div.shrink-0>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const alertIcons: Record<string, React.ReactNode> = {
  info: <Info className="size-5" />,
  success: <CheckCircle2 className="size-5" />,
  warning: <AlertTriangle className="size-5" />,
  error: <XCircle className="size-5" />,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string
  onClose?: () => void
}

function Alert({
  className,
  variant = "info",
  title,
  children,
  onClose,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <div className="flex">
        <div className="shrink-0">{alertIcons[variant || "info"]}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-semibold">{title}</h3>
          )}
          <div className={cn("text-sm", title && "mt-1")}>{children}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 p-0.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export { Alert, alertVariants }
