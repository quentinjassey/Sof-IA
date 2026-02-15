// =============================================================================
// SOF'IA — Analysis Polling Hook
// Polls the analysis status API every 4 seconds while processing.
// Stops automatically when analysis completes or fails.
// =============================================================================

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, ApiError } from '@/lib/utils/api'

/** Names of the analysis pipeline steps (WF-02) */
const ANALYSIS_STEPS = [
  { key: 'parsing_fec', label: 'Analyse du FEC' },
  { key: 'extraction_pdf', label: 'Extraction des documents PDF' },
  { key: 'rapprochement', label: 'Rapprochement ecritures / pieces' },
  { key: 'analyse_llm', label: 'Detection des signaux documentaires' },
  { key: 'consolidation', label: 'Consolidation des resultats' },
  { key: 'generation_livrables', label: 'Generation des livrables' },
] as const

/** A step in the analysis pipeline */
export interface AnalysisStep {
  key: string
  label: string
  status: 'pending' | 'active' | 'completed'
}

/** Analysis status as returned by the API */
type AnalysisStatusValue =
  | 'uploading'
  | 'analyzing'
  | 'importing'
  | 'completed'
  | 'failed'

/** API response shape for analysis status */
interface AnalysisStatusResponse {
  status: AnalysisStatusValue
  progress?: {
    step: string
    step_number: number
    total_steps: number
    percent: number
    message: string
  }
  error?: string
}

/** Return type for useAnalysisPolling hook */
export interface UseAnalysisPollingReturn {
  /** Current analysis status */
  status: AnalysisStatusValue | null
  /** Overall progress percentage (0-100) */
  progress: number
  /** Name of the current step being executed */
  currentStep: string | null
  /** Current step status message */
  currentMessage: string | null
  /** All pipeline steps with their status */
  steps: AnalysisStep[]
  /** Whether analysis has completed successfully */
  isComplete: boolean
  /** Whether analysis has failed */
  isFailed: boolean
  /** Error message if analysis failed */
  error: string | null
  /** Manually trigger a status refresh */
  refresh: () => Promise<void>
}

/** Polling interval in milliseconds (as specified in CLAUDE.md: 4 seconds) */
const POLL_INTERVAL_MS = 4000

/**
 * Custom hook for polling analysis status.
 *
 * Polls GET /api/missions/[id]/analysis/status every 4 seconds while
 * the analysis is in a processing state. Automatically stops polling
 * when the analysis completes or fails.
 *
 * @param missionId - The mission UUID being analyzed
 * @param enabled - Whether polling should be active (default: true)
 *
 * @example
 * ```tsx
 * const {
 *   status,
 *   progress,
 *   currentStep,
 *   steps,
 *   isComplete,
 *   isFailed,
 *   error,
 * } = useAnalysisPolling(missionId)
 *
 * if (isComplete) router.push(`/missions/${missionId}/signals`)
 * if (isFailed) showError(error)
 * ```
 */
export function useAnalysisPolling(
  missionId: string | undefined,
  enabled: boolean = true
): UseAnalysisPollingReturn {
  const [status, setStatus] = useState<AnalysisStatusValue | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const [currentMessage, setCurrentMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState<AnalysisStep[]>(
    ANALYSIS_STEPS.map((s) => ({ ...s, status: 'pending' as const }))
  )
  const [isComplete, setIsComplete] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track whether polling should continue
  const shouldPollRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Updates the steps array based on the current step number.
   */
  const updateSteps = useCallback((stepNumber: number) => {
    setSteps(
      ANALYSIS_STEPS.map((s, index) => ({
        ...s,
        status:
          index < stepNumber - 1
            ? 'completed'
            : index === stepNumber - 1
              ? 'active'
              : 'pending',
      }))
    )
  }, [])

  /**
   * Fetches the current analysis status from the API.
   */
  const fetchStatus = useCallback(async () => {
    if (!missionId) return

    try {
      const data = await apiFetch<AnalysisStatusResponse>(
        `/api/missions/${missionId}/analysis/status`
      )

      setStatus(data.status)

      if (data.progress) {
        setProgress(data.progress.percent)
        setCurrentStep(data.progress.step)
        setCurrentMessage(data.progress.message)
        updateSteps(data.progress.step_number)
      }

      if (data.status === 'completed') {
        setIsComplete(true)
        setIsFailed(false)
        setProgress(100)
        shouldPollRef.current = false
        // Mark all steps as completed
        setSteps(
          ANALYSIS_STEPS.map((s) => ({ ...s, status: 'completed' as const }))
        )
      } else if (data.status === 'failed') {
        setIsFailed(true)
        setIsComplete(false)
        setError(data.error || 'L\'analyse a echoue.')
        shouldPollRef.current = false
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Do not stop polling on transient errors (network issues)
        if (err.status === 404 || err.status === 401) {
          shouldPollRef.current = false
          setError(err.message)
          setIsFailed(true)
        }
        // For other errors, keep polling but set error for display
        setError(err.message)
      }
    }
  }, [missionId, updateSteps])

  // Set up polling interval
  useEffect(() => {
    if (!missionId || !enabled) return

    // Reset state when missionId changes
    shouldPollRef.current = true
    setIsComplete(false)
    setIsFailed(false)
    setError(null)
    setProgress(0)
    setCurrentStep(null)
    setCurrentMessage(null)
    setSteps(
      ANALYSIS_STEPS.map((s) => ({ ...s, status: 'pending' as const }))
    )

    // Initial fetch
    fetchStatus()

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (shouldPollRef.current) {
        fetchStatus()
      } else {
        // Stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }, POLL_INTERVAL_MS)

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      shouldPollRef.current = false
    }
  }, [missionId, enabled, fetchStatus])

  return {
    status,
    progress,
    currentStep,
    currentMessage,
    steps,
    isComplete,
    isFailed,
    error,
    refresh: fetchStatus,
  }
}
