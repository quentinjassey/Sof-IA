// =============================================================================
// SOF'IA — Signals Hook
// Manages documentary signals: fetching, filtering, statistics, and decisions.
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/utils/api'
import type {
  Signal,
  SignalPriority,
  HumanDecision,
  SignalType,
} from '@/types/database'

/** Filter options for signal queries */
export interface SignalFilters {
  priority?: SignalPriority
  type?: SignalType
  decision?: HumanDecision
  rule_triggered?: string
  sort?: string
  page?: number
  per_page?: number
}

/** Signal statistics aggregated from the current list */
export interface SignalStats {
  total: number
  by_priority: Record<SignalPriority, number>
  by_decision: Record<HumanDecision, number>
}

/** Pagination metadata from the API */
interface PaginationMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

/** Return type for useSignals hook */
export interface UseSignalsReturn {
  /** List of signals matching current filters */
  signals: Signal[]
  /** Aggregated statistics for the current signal set */
  stats: SignalStats
  /** Pagination metadata */
  pagination: PaginationMeta | null
  /** Whether signals are currently loading */
  isLoading: boolean
  /** Error message if fetch or update failed */
  error: string | null
  /** Updates a signal's human decision (validated/rejected/to_investigate) */
  updateDecision: (
    signalId: string,
    decision: Exclude<HumanDecision, 'pending'>,
    comment: string
  ) => Promise<boolean>
  /** Re-fetches signals with current filters */
  refresh: () => Promise<void>
}

/**
 * Computes aggregate statistics from a list of signals.
 */
function computeStats(signals: Signal[]): SignalStats {
  const stats: SignalStats = {
    total: signals.length,
    by_priority: { high: 0, medium: 0, low: 0 },
    by_decision: { pending: 0, validated: 0, rejected: 0, to_investigate: 0 },
  }

  for (const signal of signals) {
    if (signal.priority in stats.by_priority) {
      stats.by_priority[signal.priority]++
    }
    if (signal.human_decision in stats.by_decision) {
      stats.by_decision[signal.human_decision]++
    }
  }

  return stats
}

/**
 * Builds query string from filter parameters.
 */
function buildQueryString(filters: SignalFilters): string {
  const params = new URLSearchParams()

  if (filters.priority) params.set('priority', filters.priority)
  if (filters.type) params.set('type', filters.type)
  if (filters.decision) params.set('decision', filters.decision)
  if (filters.rule_triggered) params.set('rule_triggered', filters.rule_triggered)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.per_page) params.set('per_page', String(filters.per_page))

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Custom hook for managing documentary signals.
 *
 * Fetches signals for a mission with optional filters, computes statistics,
 * and provides a method to update signal decisions with mandatory comments.
 *
 * @param missionId - The mission UUID
 * @param filters - Optional filter parameters (priority, type, decision, sort, pagination)
 *
 * @example
 * ```tsx
 * const { signals, stats, isLoading, updateDecision, refresh } = useSignals(
 *   missionId,
 *   { priority: 'high', sort: '-priority' }
 * )
 *
 * // Update a signal decision (comment mandatory for 'rejected')
 * const success = await updateDecision(signalId, 'validated', 'Verifie par le CAC.')
 * ```
 */
export function useSignals(
  missionId: string | undefined,
  filters: SignalFilters = {}
): UseSignalsReturn {
  const [signals, setSignals] = useState<Signal[]>([])
  const [stats, setStats] = useState<SignalStats>({
    total: 0,
    by_priority: { high: 0, medium: 0, low: 0 },
    by_decision: { pending: 0, validated: 0, rejected: 0, to_investigate: 0 },
  })
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSignals = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const queryString = buildQueryString(filters)
      const response = await apiFetch<{
        data?: Signal[]
        meta?: PaginationMeta
      } | Signal[]>(
        `/api/missions/${missionId}/signals${queryString}`
      )

      // Handle both response shapes: { data, meta } or raw Signal[]
      let signalList: Signal[]
      if (Array.isArray(response)) {
        signalList = response
        setPagination(null)
      } else if (response && typeof response === 'object') {
        const resp = response as { data?: Signal[]; meta?: PaginationMeta }
        signalList = resp.data || []
        setPagination(resp.meta || null)
      } else {
        signalList = []
        setPagination(null)
      }

      setSignals(signalList)
      setStats(computeStats(signalList))
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erreur lors du chargement des signaux.')
      }
      setSignals([])
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, JSON.stringify(filters)])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  const updateDecision = useCallback(
    async (
      signalId: string,
      decision: Exclude<HumanDecision, 'pending'>,
      comment: string
    ): Promise<boolean> => {
      if (!missionId) return false

      setError(null)

      try {
        await apiFetch<Signal>(
          `/api/missions/${missionId}/signals/${signalId}`,
          {
            method: 'PATCH',
            body: {
              human_decision: decision,
              comment,
            },
          }
        )

        // Refresh signals list after successful update
        await fetchSignals()
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Erreur lors de la mise a jour du signal.')
        }
        return false
      }
    },
    [missionId, fetchSignals]
  )

  return {
    signals,
    stats,
    pagination,
    isLoading,
    error,
    updateDecision,
    refresh: fetchSignals,
  }
}
