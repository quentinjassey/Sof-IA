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
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { MissionPageHeader } from '@/components/missions/MissionPageHeader'
import { cn } from '@/lib/utils'

// --- Types ---

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
}

const STEP_LABELS = [
  'Lecture du FEC',
  'Extraction des PDF',
  'Rapprochement documentaire',
  'Analyse des signaux',
  'Consolidation',
  'Génération des livrables',
]

const POLL_INTERVAL = 4000 // 4 seconds
const MAX_POLL_DURATION = 600000 // 10 minutes

// --- Component ---

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: missionId } = use(params)
  const router = useRouter()

  const [status, setStatus] = useState<AnalysisStatus | null>(null)
  const [steps, setSteps] = useState<AnalysisStep[]>(
    STEP_LABELS.map((label, i) => ({
      number: i + 1,
      label,
      status: 'pending',
    }))
  )
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [failureType, setFailureType] = useState<'upload_failed' | 'analysis_failed' | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // --- Polling ---

  useEffect(() => {
    startTimeRef.current = Date.now()

    async function pollStatus() {
      try {
        const res = await fetch(`/api/missions/${missionId}/analysis/status`)
        if (!res.ok) {
          throw new Error('Erreur de communication avec le serveur.')
        }

        const json = await res.json()
        const data: AnalysisStatus = json.data || json

        setStatus(data)

        // Update progress
        if (data.progress) {
          setProgress(data.progress.percent)

          // Update step statuses
          setSteps((prev) =>
            prev.map((step) => {
              if (step.number < data.progress!.step_number) {
                return { ...step, status: 'completed' }
              }
              if (step.number === data.progress!.step_number) {
                return { ...step, status: data.status === 'failed' ? 'failed' : 'active' }
              }
              return { ...step, status: 'pending' }
            })
          )
        }

        // Handle completion
        if (data.status === 'completed') {
          setProgress(100)
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })))
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }

        // Handle failure
        if (data.status === 'failed') {
          const ft = data.failure_type || 'analysis_failed'
          setFailureType(ft)
          if (ft === 'upload_failed') {
            setError(data.error || 'L\'envoi des documents a échoué. Veuillez réessayer.')
          } else {
            setError(data.error || 'La pré-analyse a échoué. Veuillez réessayer.')
          }
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }

        // Check timeout
        if (Date.now() - startTimeRef.current > MAX_POLL_DURATION) {
          setError('L\'analyse a pris trop de temps. Le serveur est peut-être surchargé.')
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }
      } catch {
        setError('Erreur de communication avec le serveur.')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }

    // Initial poll
    pollStatus()

    // Set up polling interval
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL)

    // Elapsed time counter
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [missionId])

  // --- Retry ---

  async function handleRetry() {
    setRetrying(true)
    setError(null)
    setFailureType(null)
    setProgress(0)
    setSteps(STEP_LABELS.map((label, i) => ({ number: i + 1, label, status: 'pending' })))

    try {
      const res = await fetch(`/api/missions/${missionId}/analysis`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la relance.')
      }
      // Reload the page to restart polling
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la relance.')
      setRetrying(false)
    }
  }

  // --- Format elapsed time ---

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins} min ${secs.toString().padStart(2, '0')} s`
    return `${secs} s`
  }

  // --- Status indicators ---

  const isCompleted = status?.status === 'completed'
  const isFailed = status?.status === 'failed' || !!error

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Page header */}
      <MissionPageHeader
        missionId={missionId}
        title={
          isCompleted
            ? 'Pré-analyse terminée'
            : isFailed
              ? failureType === 'upload_failed'
                ? "Échec de l'envoi des documents"
                : 'Erreur lors de la pré-analyse'
              : 'Pré-analyse en cours...'
        }
        subtitle={
          isCompleted
            ? 'La pré-analyse documentaire est terminée. Consultez les signaux détectés.'
            : isFailed
              ? failureType === 'upload_failed'
                ? "L'envoi des documents vers le serveur d'analyse a échoué."
                : 'Un problème est survenu pendant l\'analyse.'
              : "Veuillez patienter pendant que Sof'IA analyse vos documents."
        }
      />

      <DisclaimerBanner />

      {/* Progress section */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="px-6 py-5">
          {/* Status icon and title */}
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
              <span
                className={cn(
                  'font-semibold',
                  isCompleted
                    ? 'text-success'
                    : isFailed
                      ? 'text-destructive'
                      : 'text-primary'
                )}
              >
                {progress}%
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isCompleted
                    ? 'bg-success'
                    : isFailed
                      ? 'bg-destructive'
                      : 'bg-primary'
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
                    step.status === 'completed'
                      ? 'font-medium text-success'
                      : step.status === 'active'
                        ? 'font-medium text-primary'
                        : step.status === 'failed'
                          ? 'font-medium text-destructive'
                          : 'text-muted-foreground'
                  )}
                >
                  {step.number}. {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {failureType === 'upload_failed'
                    ? 'Échec de l\'envoi des documents'
                    : 'Erreur lors de la pré-analyse'}
                </p>
                <p className="mt-1 text-sm text-destructive/80">
                  {failureType === 'upload_failed'
                    ? 'L\'envoi des documents a échoué. Veuillez réessayer.'
                    : 'La pré-analyse a échoué. Veuillez réessayer.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-border px-6 py-4">
          {isCompleted && (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`/missions/${missionId}/signals`)}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Consulter les signaux détectés
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/missions/${missionId}/deliverables`)}
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
                {failureType === 'upload_failed'
                  ? 'Renvoyer les documents'
                  : 'Relancer la pré-analyse'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/missions/${missionId}/documents`)}
              >
                Retour aux documents
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
