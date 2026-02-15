// =============================================================================
// SOF'IA — Documents Hook
// Manages document operations: fetch, upload, remove, and completeness.
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/utils/api'
import type { Document, Completeness } from '@/types/database'

/** Return type for useDocuments hook */
export interface UseDocumentsReturn {
  /** List of documents attached to the mission */
  documents: Document[]
  /** Completeness assessment (expected vs received documents) */
  completeness: Completeness[]
  /** Whether documents are currently loading */
  isLoading: boolean
  /** Whether an upload or delete operation is in progress */
  isUploading: boolean
  /** Error message if any operation failed */
  error: string | null
  /** Uploads multiple files sequentially to the mission */
  upload: (files: File[]) => Promise<boolean>
  /** Removes a document by its ID */
  remove: (docId: string) => Promise<boolean>
  /** Re-fetches documents and completeness data */
  refresh: () => Promise<void>
}

/**
 * Custom hook for managing mission documents.
 *
 * Provides CRUD operations for documents attached to a mission,
 * including multi-file upload, deletion, and completeness tracking.
 *
 * @param missionId - The mission UUID
 *
 * @example
 * ```tsx
 * const {
 *   documents,
 *   completeness,
 *   isLoading,
 *   isUploading,
 *   upload,
 *   remove,
 *   refresh,
 * } = useDocuments(missionId)
 *
 * // Upload files from a drag-drop handler
 * const handleDrop = async (files: File[]) => {
 *   const success = await upload(files)
 *   if (success) showToast('Documents telecharges')
 * }
 *
 * // Remove a document
 * const handleRemove = async (docId: string) => {
 *   const success = await remove(docId)
 *   if (success) showToast('Document supprime')
 * }
 * ```
 */
export function useDocuments(
  missionId: string | undefined
): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([])
  const [completeness, setCompleteness] = useState<Completeness[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch documents and completeness in parallel
      const [docsData, completenessData] = await Promise.all([
        apiFetch<Document[]>(`/api/missions/${missionId}/documents`),
        apiFetch<Completeness[]>(
          `/api/missions/${missionId}/documents/completeness`
        ).catch(() => [] as Completeness[]),
      ])

      setDocuments(docsData)
      setCompleteness(completenessData)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erreur lors du chargement des documents.')
      }
      setDocuments([])
      setCompleteness([])
    } finally {
      setIsLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  /**
   * Uploads multiple files sequentially.
   * Uses FormData for file upload via POST /api/missions/[id]/documents.
   */
  const upload = useCallback(
    async (files: File[]): Promise<boolean> => {
      if (!missionId || files.length === 0) return false

      setIsUploading(true)
      setError(null)

      try {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)

          await apiFetch<Document[]>(
            `/api/missions/${missionId}/documents`,
            {
              method: 'POST',
              body: formData,
            }
          )
        }

        // Refresh documents list after all uploads complete
        await fetchDocuments()
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Erreur lors du telechargement des documents.')
        }
        // Refresh anyway to show partial uploads
        await fetchDocuments()
        return false
      } finally {
        setIsUploading(false)
      }
    },
    [missionId, fetchDocuments]
  )

  /**
   * Removes a document by its ID.
   * Calls DELETE /api/missions/[id]/documents?docId=xxx
   */
  const remove = useCallback(
    async (docId: string): Promise<boolean> => {
      if (!missionId) return false

      setError(null)

      try {
        await apiFetch<{ success: true }>(
          `/api/missions/${missionId}/documents?docId=${docId}`,
          { method: 'DELETE' }
        )

        // Refresh documents list after deletion
        await fetchDocuments()
        return true
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Erreur lors de la suppression du document.')
        }
        return false
      }
    },
    [missionId, fetchDocuments]
  )

  return {
    documents,
    completeness,
    isLoading,
    isUploading,
    error,
    upload,
    remove,
    refresh: fetchDocuments,
  }
}
