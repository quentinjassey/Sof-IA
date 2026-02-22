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
import { cn } from '@/lib/utils'

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
  'Generation des livrables',
]

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

  const [status, setStatus] = useState<AnalysisStatus | null>(null)
  const [steps, setSteps] = useState<AnalysisStep[]>(
    STEP_LABELS.map((label, i) => ({ number: i + 1, label, status: 'pending' }))
  )
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [failureType, setFailureType] = useState<'upload_failed' | 'analysis_failed' | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    startTimeRef.current = Date.now()

    async function pollStatus() {
      try {
        const res = await fetch(`/api/missions/${missionId}/analysis/status`)
        if (!res.ok) throw new Error('Erreur de communication avec le serveur.')

        const json = await res.json()
        const data: AnalysisStatus = json.data || json
        setStatus(data)

        if (data.progress) {
          setProgress(data.progress.percent)
          const newSteps = STEP_LABELS.map((label, i) => ({
            number: i + 1,
            label,
            status: (i + 1 < data.progress!.step_number
              ? 'completed'
              : i + 1 === data.progress!.step_number
                ? 'active'
                : 'pending') as AnalysisStep['status'],
          }))
          setSteps(newSteps)
        }

        if (data.status === 'completed') {
          setProgress(100)
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })))
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          setTimeout(() => router.push(`${basePath}/signals`), 1500)
          return
        }

        if (data.status === 'failed') {
          setError(data.error || 'La pre-analyse a echoue.')
          setFailureType(data.failure_type || null)
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
          return
        }

        if (Date.now() - startTimeRef.current > MAX_POLL_DURATION) {
          setError('L\'analyse a pris trop de temps.')
          if (pollRef.current) clearInterval(pollRef.current)
          if (timerRef.current) clearInterval(timerRef.current)
        }
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
  }, [missionId, router, basePath])

  const handleRetry = async () => {
    setRetrying(true)
    setError(null)
    setFailureType(null)
    setProgress(0)
    setSteps(STEP_LABELS.map((label, i) => ({ number: i + 1, label, status: 'pending' })))

    try {
      const res = await fetch(`/api/missions/${missionId}/analysis`, { method: 'POST' })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Impossible de relancer l\'analyse.')
        return
      }
      startTimeRef.current = Date.now()
      setElapsedTime(0)
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/missions/${missionId}/analysis/status`)
          if (r.ok) {
            const json = await r.json()
            const d: AnalysisStatus = json.data || json
            setStatus(d)
            if (d.status === 'completed') {
              setProgress(100)
              if (pollRef.current) clearInterval(pollRef.current)
              setTimeout(() => router.push(`${basePath}/signals`), 1500)
            }
          }
        } catch { /* silent */ }
      }, POLL_INTERVAL)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setRetrying(false)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}min ${s}s` : `${s}s`
  }

  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <DisclaimerBanner />

      <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="mb-2 font-serif text-xl text-card-foreground">
          Pre-analyse en cours
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Sof&apos;IA analyse vos documents. Temps ecoule : {formatTime(elapsedTime)}
        </p>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                error ? 'bg-destructive' : progress === 100 ? 'bg-success' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>

        {/* Steps */}
        <div className="mb-8 space-y-3 text-left">
          {steps.map((step) => (
            <div key={step.number} className="flex items-center gap-3">
              {step.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : step.status === 'active' ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : step.status === 'failed' ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
              <span className={cn(
                'text-sm',
                step.status === 'active' ? 'font-medium text-foreground' :
                step.status === 'completed' ? 'text-success' :
                step.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button
              onClick={handleRetry}
              disabled={retrying}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reessayer
            </Button>
          </div>
        )}

        {/* Completed */}
        {status?.status === 'completed' && (
          <div className="rounded-xl border border-success/20 bg-success/5 p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Pre-analyse terminee</span>
            </div>
            <Button
              onClick={() => router.push(`${basePath}/signals`)}
              className="mt-3"
              size="sm"
            >
              Voir les signaux <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
