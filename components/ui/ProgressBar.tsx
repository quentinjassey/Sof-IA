import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressStep {
  label: string
  completed: boolean
  active?: boolean
}

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  showPercentage?: boolean
  label?: string
  steps?: ProgressStep[]
  size?: "sm" | "md" | "lg"
  animated?: boolean
}

const sizeClasses: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
}

function ProgressBar({
  value,
  showPercentage = true,
  label,
  steps,
  size = "md",
  animated = true,
  className,
  ...props
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  const barColor =
    clampedValue >= 100
      ? "bg-success"
      : "bg-primary"

  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-sm font-medium text-foreground">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(clampedValue)} %
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Progression : ${Math.round(clampedValue)} %`}
      >
        <div
          className={cn(
            sizeClasses[size],
            barColor,
            "rounded-full",
            animated && "transition-all duration-500 ease-out"
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>

      {steps && steps.length > 0 && (
        <div className="mt-3">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col items-center"
                style={{ width: `${100 / steps.length}%` }}
              >
                <div
                  className={cn(
                    "size-3 rounded-full border-2 mb-1 transition-colors duration-200",
                    step.completed
                      ? "bg-success border-success"
                      : step.active
                        ? "bg-background border-primary"
                        : "bg-background border-border"
                  )}
                />
                <span
                  className={cn(
                    "text-xs text-center leading-tight",
                    step.completed
                      ? "text-success font-medium"
                      : step.active
                        ? "text-primary font-medium"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { ProgressBar }
