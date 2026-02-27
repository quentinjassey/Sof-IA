'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'

interface KPICardProps {
  icon: React.ReactNode
  value: number | string
  label: string
  accent?: 'default' | 'warning' | 'destructive' | 'success'
  subtitle?: string
}

export function KPICard({ icon, value, label, accent = 'default', subtitle }: KPICardProps) {
  return (
    <Card className="px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md [&>span>svg]:h-4 [&>span>svg]:w-4',
            accent === 'destructive' && 'bg-destructive/10',
            accent === 'warning' && 'bg-warning/10',
            accent === 'success' && 'bg-success/10',
            accent === 'default' && 'bg-muted'
          )}
        >
          <span
            className={cn(
              accent === 'destructive' && 'text-destructive',
              accent === 'warning' && 'text-warning-foreground',
              accent === 'success' && 'text-success',
              accent === 'default' && 'text-muted-foreground'
            )}
          >
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'text-lg font-semibold leading-tight',
              accent === 'destructive' && 'text-destructive',
              accent === 'warning' && 'text-warning-foreground',
              accent !== 'destructive' && accent !== 'warning' && 'text-foreground'
            )}
          >
            {value}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
