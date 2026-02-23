'use client'

import {
  BarChart3,
  Scissors,
  FileSearch,
  Play,
  RefreshCw,
  Eye,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioType, MissionStatus, Mission } from '@/types/database'

const SCENARIO_CONFIG: Record<ScenarioType, {
  label: string
  description: string
  icon: React.ReactNode
}> = {
  sondage_ca: {
    label: 'Sondage sur le chiffre d\'affaires',
    description: 'Rapprochement factures / bons de livraison / écritures FEC',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  cutoff: {
    label: 'Césure d\'exercice (cut-off)',
    description: 'Rattachement temporel des opérations autour de la clôture',
    icon: <Scissors className="h-5 w-5" />,
  },
  pointage: {
    label: 'Pointage états financiers / annexe',
    description: 'Cohérence bilan, compte de résultat et annexe',
    icon: <FileSearch className="h-5 w-5" />,
  },
}

const STATUS_DISPLAY: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  created: { label: 'Prêt', icon: <Clock className="h-3.5 w-3.5" />, color: 'text-muted-foreground' },
  documents_ready: { label: 'Documents prêts', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-primary' },
  analyzing: { label: 'Analyse en cours', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-primary' },
  analysis_failed: { label: 'Échec', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-destructive' },
  analyzed: { label: 'Analysée', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-success' },
  in_review: { label: 'En revue', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-warning-foreground' },
  completed: { label: 'Terminée', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-success' },
}

interface AnalysisCardProps {
  scenario: ScenarioType
  mission?: Mission | null
  signalCount?: number
  onLaunch: (scenario: ScenarioType) => void
  onRelaunch?: (mission: Mission) => void
  onViewResults?: (mission: Mission) => void
  isLaunching?: boolean
}

export default function AnalysisCard({
  scenario,
  mission,
  signalCount,
  onLaunch,
  onRelaunch,
  onViewResults,
  isLaunching,
}: AnalysisCardProps) {
  const config = SCENARIO_CONFIG[scenario]
  const status = mission ? STATUS_DISPLAY[mission.status] || STATUS_DISPLAY.created : null
  const hasResults = mission && ['analyzed', 'in_review', 'completed'].includes(mission.status)
  const isAnalyzing = mission?.status === 'analyzing'
  const canLaunch = mission && ['created', 'documents_ready', 'upload_failed'].includes(mission.status)
  const canRelaunch = hasResults || mission?.status === 'analysis_failed'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-5 transition-all',
        hasResults ? 'border-success/30' : isAnalyzing ? 'border-primary/30' : 'border-border'
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-lg',
            hasResults ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          )}
        >
          {config.icon}
        </div>
        {status && (
          <span className={cn('flex items-center gap-1 text-xs font-medium', status.color)}>
            {status.icon}
            {status.label}
          </span>
        )}
      </div>

      <h3 className="mb-1 text-sm font-semibold text-card-foreground">{config.label}</h3>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{config.description}</p>

      {hasResults && signalCount !== undefined && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning-foreground" />
          <span className="text-xs font-medium text-foreground">
            {signalCount} {signalCount !== 1 ? 'signaux documentaires' : 'signal documentaire'}
          </span>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {!mission || canLaunch ? (
          <button
            onClick={() => onLaunch(scenario)}
            disabled={isLaunching}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:brightness-110 disabled:opacity-50'
            )}
          >
            {isLaunching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Lancer l&apos;analyse
          </button>
        ) : (
          <>
            {hasResults && onViewResults && (
              <button
                onClick={() => onViewResults(mission)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all',
                  'bg-primary text-primary-foreground shadow-sm',
                  'hover:brightness-110'
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Voir les résultats
              </button>
            )}
            {canRelaunch && onRelaunch && (
              <button
                onClick={() => onRelaunch(mission)}
                disabled={isLaunching}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-medium transition-all',
                  'text-muted-foreground hover:bg-accent hover:text-foreground',
                  'disabled:opacity-50'
                )}
              >
                {isLaunching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Relancer
              </button>
            )}
            {isAnalyzing && (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyse en cours...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
