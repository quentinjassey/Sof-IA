import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  showCharCount?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, required, id, showCharCount, maxLength, value, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined)
    const charCount = typeof value === "string" ? value.length : 0

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
            {required && (
              <span className="text-destructive ml-0.5" aria-label="champ obligatoire">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={textareaId}
          required={required}
          maxLength={maxLength}
          value={value}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          ref={ref}
          {...props}
        />
        <div className="flex items-center justify-between mt-1.5">
          {error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : helperText ? (
            <p className="text-sm text-muted-foreground">{helperText}</p>
          ) : (
            <span />
          )}
          {showCharCount && maxLength && (
            <span className="text-xs text-muted-foreground">
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
