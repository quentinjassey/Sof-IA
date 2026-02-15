// =============================================================================
// SOF'IA — Mission Hook
// Fetches mission detail, documents, and signals for a given mission ID.
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/utils/api'
import type { Mission, Document, Signal } from '@/types/database'

/** Return type for useMission hook */
export interface UseMissionReturn {
  /** Mission data (null while loading or if not found) */
  mission: Mission | null
  /** List of documents attached to the mission */
  documents: Document[]
  /** List of signals detected for the mission */
  signals: Signal[]
  /** Whether mission data is currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Re-fetches all mission data */
  refresh: () => Promise<void>
}

/**
 * Custom hook for fetching mission data including documents and signals.
 *
 * @param missionId - The mission UUID to fetch data for
 *
 * @example
 * ```tsx
 * const { mission, documents, signals, isLoading, error, refresh } = useMission(id)
 *
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorMessage message={error} />
 * if (!mission) return <NotFound />
 *
 * return <MissionDetail mission={mission} documents={documents} />
 * ```
 */
export function useMission(missionId: string | undefined): UseMissionReturn {
  const [mission, setMission] = useState<Mission | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMissionData = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      setError('Identifiant de mission manquant.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch mission detail, documents, and signals in parallel
      const [missionData, documentsData, signalsData] = await Promise.all([
        apiFetch<Mission>(`/api/missions/${missionId}`),
        apiFetch<Document[]>(`/api/missions/${missionId}/documents`).catch(
          () => [] as Document[]
        ),
        apiFetch<Signal[]>(`/api/missions/${missionId}/signals`).catch(
          () => [] as Signal[]
        ),
      ])

      setMission(missionData)
      setDocuments(documentsData)

      // Handle signals response — may come with { data, meta } structure
      if (Array.isArray(signalsData)) {
        setSignals(signalsData)
      } else if (
        signalsData &&
        typeof signalsData === 'object' &&
        'data' in (signalsData as Record<string, unknown>)
      ) {
        setSignals(
          (signalsData as unknown as { data: Signal[] }).data
        )
      } else {
        setSignals([])
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erreur lors du chargement de la mission.')
      }
      setMission(null)
      setDocuments([])
      setSignals([])
    } finally {
      setIsLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchMissionData()
  }, [fetchMissionData])

  return {
    mission,
    documents,
    signals,
    isLoading,
    error,
    refresh: fetchMissionData,
  }
}
