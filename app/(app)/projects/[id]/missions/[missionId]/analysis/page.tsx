'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Scissors,
  FileSearch,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { ScenarioType } from '@/types/database'

interface AnalysisStep {
  number: number
  label: string
  status: 'pending' | 'active' | 'completed' | 'failed'
}

interface AnalysisStatus {
  status: 'uploading' | 'analyzing' | 'importing' | 'completed' | 'failed'
  progress?: {
    step: string
    step_number: number
    total_steps: number
    percent: number
    message: string
  }
  error?: string
  failure_type?: 'upload_failed' | 'analysis_failed'
  results_summary?: {
    signals_generated?: number
    ecritures_parsed?: number
    pieces_testees?: number
    couverture_ca_pct?: number
    deliverables_generated?: number
  }
}

const SCENARIO_STEPS: Record<ScenarioType, string[]> = {
  sondage_ca: [
    'Lecture du FEC',
    'Extraction des pièces justificatives',
    'Rapprochement documentaire',
    'Analyse des signaux',
    'Consolidation des résultats',
    'Génération des livrables',
  ],
  cutoff: [
    'Lecture du FEC',
    'Analyse des opérations de clôture',
    'Vérification du rattachement temporel',
    'Consolidation des résultats',
  ],
  pointage: [
    'Extraction des états financiers',
    'Comparaison bilan / annexe',
    'Vérification des informations obligatoires',
    'Consolidation des résultats',
  ],
}

const SCENARIO_META: Record<ScenarioType, { label: string; icon: React.ReactNode; description: string }> = {
  sondage_ca: {
    label: 'Sondage sur le chiffre d\'affaires',
    icon: <BarChart3 className="h-6 w-6" />,
    description: 'Rapprochement des factures de vente avec les bons de livraison et les écritures du FEC.',
  },
  cutoff: {
    label: 'Césure d\'exercice (cut-off)',
    icon: <Scissors className="h-6 w-6" />,
    description: 'Vérification du rattachement temporel des opérations autour de la date de clôture.',
  },
  pointage: {
    label: 'Pointage états financiers / annexe',
    icon: <FileSearch className="h-6 w-6" />,
    description: 'Cohérence entre le bilan, le compte de résultat et l\'annexe.',
  },
}

const POLL_INTERVAL = 4000
const MAX_POLL_DURATION = 600000

export default function ProjectAnalysisPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { id: projectId, missionId } = use(params)
  const router = useRouter()
  const basePath = `/projects/${projectId}/missions/${missionId}`

  const [scenario, setScenario] = useState<ScenarioType | null>(null)
  const [status, setStatus] = useState<AnalysisStatus | null>(null)
  const [steps, setSteps] = useState<AnalysisStep[]>([])
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [failureType, setFailureType] = useState<'upload_failed' | 'analysis_failed' | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const isFirstPollRef = useRef(true)
  const wasActiveRef = useRef(false)

  useEffect(() => {
    async function fetchMissionScenario() {
      try {
        const res = await fetch(`/api/missions/${missionId}`)
        if (res.ok) {
          const json = await res.json()
          const missionScenario = json.data?.scenario as ScenarioType
          if (missionScenario) {
            setScenario(missionScenario)
            const labels = SCENARIO_STEPS[missionScenario]
            setSteps(labels.map((label, i) => ({ number: i + 1, label, status: 'pending' })))
          }
        }
      } catch {
        setSteps(SCENARIO_STEPS.sondage_ca.map((label, i) => ({ number: i + 1, label, status: 'pending' })))
      }
    }
    fetchMissionScenario()
  }, [missionId])

  useEffect(() => {
    if (!scenario) return

    startTimeRef.current = Date.now()
    isFirstPollRef.current = true
    wasActiveRef.current = false
    const stepLabels = SCENARIO_STEPS[scenario]

    async function pollStatus() {
      try {
        const res = await fetch(`/api/missions/${missionId}/analysis/status`)
        if (!res.ok) throw new Error('Erreur de communication avec le serveur.')

        const json = await res.json()
        const data: AnalysisStatus = json.data || json
        setStatus(data)

        if (data.progress) {
          setProgress(data.progress.percent)

          const totalSteps = stepLabels.length
          const mappedStep = Math.min(
            Math.ceil((data.progress.step_number / data.progress.total_steps) * totalSteps),
            totalSteps
          )

          setSteps(
            stepLabels.map((label, i) => ({
              number: i + 1,
              label,
              status: (i + 1 < mappedStep
                ? 'completed'
                : i + 1 === mappedStep
                  ? data.status === 'failed' ? 'failed' : 'active'
                  : 'pending') as AnalysisStep['status'],
            }))
          )
        }

        if (data.status === 'analyzing' || data.status === 'uploading' || data.status === 'importing') {
          wasActiveRef.current = true
        }

        if (data.status === 'completed') {
          setProgress(100)
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })))
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)

          if (wasActiveRef.current) {
            setTimeout(() => router.push(`${basePath}/signals`), 1500)
          }
          return
        }

        if (data.status === 'failed') {
          const ft = data.failure_type || 'analysis_failed'
          setFailureType(ft)
          setError(
            ft === 'upload_failed'
              ? (data.error || 'L\'envoi des documents a échoué. Veuillez réessayer.')
              : (data.error || 'La pré-analyse a échoué. Veuillez réessayer.')
          )
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }

        if (Date.now() - startTimeRef.current > MAX_POLL_DURATION) {
          setError('L\'analyse a pris trop de temps. Le serveur est peut-être surchargé.')
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }

        isFirstPollRef.current = false
      } catch {
        setError('Erreur de communication avec le serveur.')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }

    pollStatus()
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL)
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [missionId, router, basePath, scenario])

  const handleRetry = async () => {
    setRetrying(true)
    setError(null)
    setFailureType(null)
    setProgress(0)
    if (scenario) {
      setSteps(SCENARIO_STEPS[scenario].map((label, i) => ({ number: i + 1, label, status: 'pending' })))
    }

    try {
      const res = await fetch(`/api/missions/${missionId}/analysis`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la relance.')
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la relance.')
      setRetrying(false)
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins} min ${secs.toString().padStart(2, '0')} s`
    return `${secs} s`
  }

  const isCompleted = status?.status === 'completed'
  const isFailed = status?.status === 'failed' || !!error
  const scenarioMeta = scenario ? SCENARIO_META[scenario] : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-foreground">
          {isCompleted
            ? 'Pré-analyse terminée'
            : isFailed
              ? failureType === 'upload_failed'
                ? 'Échec de l\'envoi des documents'
                : 'Erreur lors de la pré-analyse'
              : 'Pré-analyse en cours...'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCompleted
            ? 'La pré-analyse documentaire est terminée. Consultez les signaux détectés.'
            : isFailed
              ? 'Un problème est survenu pendant l\'analyse.'
              : 'Veuillez patienter pendant que Sof\'IA analyse vos documents.'}
        </p>
      </div>

      <DisclaimerBanner />

      {/* Scenario badge */}
      {scenarioMeta && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {scenarioMeta.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-card-foreground">{scenarioMeta.label}</p>
            <p className="text-xs text-muted-foreground">{scenarioMeta.description}</p>
          </div>
        </div>
      )}

      {/* Progress section */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3">
            {isCompleted ? (
              <CheckCircle className="h-8 w-8 text-success" />
            ) : isFailed ? (
              <XCircle className="h-8 w-8 text-destructive" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
            <div>
              <p className="text-lg font-semibold text-card-foreground">
                {isCompleted
                  ? 'Analyse complétée avec succès'
                  : isFailed
                    ? 'Analyse interrompue'
                    : status?.progress?.message || 'Initialisation...'}
              </p>
              <p className="text-sm text-muted-foreground">
                Temps écoulé : {formatTime(elapsedTime)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-card-foreground">Progression</span>
              <span className={cn('font-semibold', isCompleted ? 'text-success' : isFailed ? 'text-destructive' : 'text-primary')}>
                {progress}%
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isCompleted ? 'bg-success' : isFailed ? 'bg-destructive' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="mt-6 space-y-3">
            {steps.map((step) => (
              <div key={step.number} className="flex items-center gap-3">
                {step.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 text-success" />
                ) : step.status === 'active' ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-primary" />
                ) : step.status === 'failed' ? (
                  <XCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-border" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    step.status === 'completed' ? 'font-medium text-success'
                      : step.status === 'active' ? 'font-medium text-primary'
                      : step.status === 'failed' ? 'font-medium text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.number}. {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Results summary */}
          {isCompleted && status?.results_summary && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {status.results_summary.signals_generated != null && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{status.results_summary.signals_generated}</p>
                  <p className="text-[10px] text-muted-foreground">signaux détectés</p>
                </div>
              )}
              {status.results_summary.ecritures_parsed != null && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{status.results_summary.ecritures_parsed}</p>
                  <p className="text-[10px] text-muted-foreground">écritures analysées</p>
                </div>
              )}
              {status.results_summary.pieces_testees != null && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{status.results_summary.pieces_testees}</p>
                  <p className="text-[10px] text-muted-foreground">pièces testées</p>
                </div>
              )}
              {status.results_summary.deliverables_generated != null && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{status.results_summary.deliverables_generated}</p>
                  <p className="text-[10px] text-muted-foreground">livrables générés</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {failureType === 'upload_failed' ? 'Échec de l\'envoi des documents' : 'Erreur lors de la pré-analyse'}
                </p>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border px-6 py-4">
          {isCompleted && (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`${basePath}/signals`)}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Consulter les signaux détectés
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`${basePath}/deliverables`)}
              >
                Voir les livrables
              </Button>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={handleRetry}
                loading={retrying}
                disabled={retrying}
                iconLeft={<RefreshCw className="h-4 w-4" />}
              >
                {failureType === 'upload_failed' ? 'Renvoyer les documents' : 'Relancer la pré-analyse'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/projects/${projectId}`)}
              >
                Retour au projet
              </Button>
            </div>
          )}
          {!isCompleted && !isFailed && (
            <p className="text-xs text-muted-foreground">
              L&apos;analyse est en cours. Cette page se met à jour automatiquement.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
