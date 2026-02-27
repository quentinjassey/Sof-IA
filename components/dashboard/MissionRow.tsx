'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, AlertTriangle, Clock, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { DashboardMission, DashboardSignal } from '@/types/dashboard'

const scenarioLabels: Record<string, string> = {
  sondage_ca: 'Sondage CA',
  cutoff: 'Cut-off',
  pointage: 'Pointage',
}

function getMissionStatusVariant(status: string) {
  if (['analyzed', 'in_review', 'completed'].includes(status)) return 'complete' as const
  if (status === 'analyzing') return 'analyzing' as const
  if (['upload_failed', 'analysis_failed'].includes(status)) return 'failed' as const
  return 'created' as const
}

function getMissionStatusLabel(status: string) {
  if (['analyzed', 'in_review', 'completed'].includes(status)) return 'Terminée'
  if (status === 'analyzing') return 'En cours'
  if (['upload_failed', 'analysis_failed'].includes(status)) return 'Échouée'
  return 'Créée'
}

interface MissionRowProps {
  mission: DashboardMission
  signals: DashboardSignal[]
  projectId: string
  index: number
}

export function MissionRow({ mission, signals, projectId, index }: MissionRowProps) {
  const router = useRouter()

  const missionSignals = signals.filter((s) => s.mission_id === mission.id)
  const highPriority = missionSignals.filter((s) => s.priority === 'high').length
  const mediumPriority = missionSignals.filter((s) => s.priority === 'medium').length
  const pending = missionSignals.filter((s) => s.human_decision === 'pending').length

  const href = `/projects/${projectId}/missions/${mission.id}/signals`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(href)
      }}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all cursor-pointer',
        'hover:border-primary/20 hover:shadow-sm',
        'animate-fade-in opacity-0'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Scenario + status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge
            variant={getMissionStatusVariant(mission.status)}
            icon={<BarChart3 className="h-3 w-3" />}
          >
            {scenarioLabels[mission.scenario] || mission.scenario}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {getMissionStatusLabel(mission.status)}
          </span>
        </div>

        {/* Signal summary */}
        {missionSignals.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {missionSignals.length} {missionSignals.length !== 1 ? 'signaux' : 'signal'}
            </span>
            {highPriority > 0 && (
              <Badge variant="priority-high">
                {highPriority} haute{highPriority !== 1 ? 's' : ''}
              </Badge>
            )}
            {mediumPriority > 0 && (
              <Badge variant="priority-medium">
                {mediumPriority} moyenne{mediumPriority !== 1 ? 's' : ''}
              </Badge>
            )}
            {pending > 0 && (
              <span className="flex items-center gap-1 text-warning-foreground">
                <Clock className="h-3 w-3" />
                {pending} en attente
              </span>
            )}
          </div>
        )}

        {missionSignals.length === 0 && (
          <p className="mt-1.5 text-xs italic text-muted-foreground/60">
            Aucun signal détecté
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>
  )
}
