'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, AlertTriangle, Clock, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { CompanyLogo, extractCompanyFromTitle } from '@/components/missions/CompanyLogo'
import type { DashboardProject, DashboardMission, DashboardSignal } from '@/types/dashboard'

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

interface ProjectCardProps {
  project: DashboardProject
  missions: DashboardMission[]
  signals: DashboardSignal[]
  index: number
}

export function ProjectCard({ project, missions, signals, index }: ProjectCardProps) {
  const router = useRouter()

  const highPriority = signals.filter((s) => s.priority === 'high').length
  const pending = signals.filter((s) => s.human_decision === 'pending').length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/projects/${project.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}`)
      }}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all cursor-pointer',
        'hover:border-primary/20 hover:shadow-sm',
        'animate-fade-in opacity-0'
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <CompanyLogo name={extractCompanyFromTitle(project.name)} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-card-foreground transition-colors group-hover:text-primary">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Missions row */}
      {missions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {missions.map((mission) => (
            <Badge
              key={mission.id}
              variant={getMissionStatusVariant(mission.status)}
              icon={<BarChart3 className="h-3 w-3" />}
            >
              {scenarioLabels[mission.scenario] || mission.scenario}
              {' — '}
              {getMissionStatusLabel(mission.status)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">
          Aucune analyse lancée
        </p>
      )}

      {/* Signal summary row */}
      {signals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {signals.length} {signals.length !== 1 ? 'signaux' : 'signal'}
          </span>
          {highPriority > 0 && (
            <Badge variant="priority-high">
              {highPriority} haute{highPriority !== 1 ? 's' : ''}
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
    </div>
  )
}
