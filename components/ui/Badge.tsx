import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",

        // Priorities
        "priority-high": "bg-destructive/10 text-destructive",
        "priority-medium": "bg-warning/10 text-warning-foreground",
        "priority-low": "bg-muted text-muted-foreground",

        // Human decisions
        pending: "bg-muted text-muted-foreground",
        validated: "bg-success/10 text-success",
        rejected: "bg-destructive/10 text-destructive",
        "to-investigate": "bg-warning/10 text-warning-foreground",

        // Mission statuses
        created: "bg-muted text-muted-foreground",
        analyzing: "bg-primary/10 text-primary animate-pulse",
        complete: "bg-success/10 text-success",
        failed: "bg-destructive/10 text-destructive",

        // Extra
        outline: "border border-border text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
}

function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && <span className="shrink-0 size-3">{icon}</span>}
      {children}
    </span>
  )
}

/**
 * Labels en français pour les badges de décision
 */
const decisionLabels: Record<string, string> = {
  pending: "En attente",
  validated: "Validé",
  rejected: "Rejeté",
  "to-investigate": "À approfondir",
}

/**
 * Labels en français pour les badges de statut de mission
 */
const statusLabels: Record<string, string> = {
  created: "Créé",
  analyzing: "Analyse en cours",
  complete: "Terminé",
  failed: "Échoué",
}

/**
 * Labels en français pour les badges de priorité
 */
const priorityLabels: Record<string, string> = {
  "priority-high": "Haute",
  "priority-medium": "Moyenne",
  "priority-low": "Basse",
}

export { Badge, badgeVariants, decisionLabels, statusLabels, priorityLabels }
