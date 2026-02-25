'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  FolderOpen,
  RefreshCw,
  Database,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MissionPageHeader } from '@/components/missions/MissionPageHeader'

const PdfPreviewModal = dynamic(
  () => import('@/components/ui/PdfPreviewModal').then((m) => m.PdfPreviewModal),
  { ssr: false }
)
import DropZone, { type StagedFile } from '@/components/documents/DropZone'
import { UploadProgress, type FileProgress } from '@/components/documents/UploadProgress'
import { DocumentList } from '@/components/documents/DocumentList'
import { uploadWithProgress } from '@/lib/utils/upload'
import { cn } from '@/lib/utils'

// --- Types ---

interface UploadedDocument {
  id: string
  mission_id: string
  type: string
  filename: string
  storage_path: string
  file_size: number | null
  status: string
  added_at: string
}

interface CompletenessEntry {
  doc_type: string
  label: string
  required: boolean
  status: 'present' | 'missing' | 'incomplete'
  count: number
  note: string | null
}

interface MissionData {
  id: string
  name: string
  scenario: string
  status: string
  company_id?: string | null
}

// --- Helper ---

function statusBadge(status: string) {
  switch (status) {
    case 'present':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
          <CheckCircle className="h-3 w-3" />
          Présent
        </span>
      )
    case 'missing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
          <XCircle className="h-3 w-3" />
          Manquant
        </span>
      )
    case 'incomplete':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
          <AlertCircle className="h-3 w-3" />
          Incomplet
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {status}
        </span>
      )
  }
}

// --- Component ---

export default function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: missionId } = use(params)
  const router = useRouter()

  const [mission, setMission] = useState<MissionData | null>(null)
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [completeness, setCompleteness] = useState<CompletenessEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const [overallProgress, setOverallProgress] = useState(0)
  const [launchingAnalysis, setLaunchingAnalysis] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    try {
      const [missionRes, docsRes, completenessRes] = await Promise.all([
        fetch(`/api/missions/${missionId}`),
        fetch(`/api/missions/${missionId}/documents`),
        fetch(`/api/missions/${missionId}/documents/completeness`),
      ])

      if (missionRes.ok) {
        const missionJson = await missionRes.json()
        setMission(missionJson.data)
      }
      if (docsRes.ok) {
        const docsJson = await docsRes.json()
        setDocuments(docsJson.data || [])
      }
      if (completenessRes.ok) {
        const compJson = await completenessRes.json()
        setCompleteness(Array.isArray(compJson.data) ? compJson.data : [])
      }
    } catch {
      setError('Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Upload with real progress ---

  async function handleUpload(stagedFiles: StagedFile[]) {
    if (stagedFiles.length === 0) return

    setUploading(true)
    setError(null)

    // Initialize file progress
    const initialProgress: FileProgress[] = stagedFiles.map((sf) => ({
      id: sf.id,
      filename: sf.file.name,
      size: sf.file.size,
      progress: 0,
      status: 'pending' as const,
    }))
    setFileProgress(initialProgress)
    setOverallProgress(0)

    const formData = new FormData()
    stagedFiles.forEach((sf) => {
      formData.append('files', sf.file)
      formData.append('types', sf.detectedType)
    })

    // Mark all as uploading
    setFileProgress((prev) =>
      prev.map((f) => ({ ...f, status: 'uploading' as const }))
    )

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await uploadWithProgress(
        `/api/missions/${missionId}/documents`,
        formData,
        (event) => {
          setOverallProgress(event.percent)
          setFileProgress((prev) =>
            prev.map((f) => ({
              ...f,
              progress: event.percent,
              status: event.percent >= 100 ? 'complete' as const : 'uploading' as const,
            }))
          )
        },
        controller.signal
      )

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error((data.error as string) || "Erreur lors de l'envoi des documents.")
      }

      // Mark all as complete
      setFileProgress((prev) =>
        prev.map((f) => ({ ...f, progress: 100, status: 'complete' as const }))
      )
      setOverallProgress(100)

      // Refresh data
      await fetchData()

      // Clear progress after a short delay
      setTimeout(() => {
        setFileProgress([])
        setOverallProgress(0)
      }, 2000)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setFileProgress([])
        setOverallProgress(0)
      } else {
        setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.")
        setFileProgress((prev) =>
          prev.map((f) =>
            f.status !== 'complete'
              ? { ...f, status: 'error' as const, error: "Échec de l'envoi" }
              : f
          )
        )
      }
    } finally {
      setUploading(false)
      abortControllerRef.current = null
    }
  }

  function handleCancelUpload() {
    abortControllerRef.current?.abort()
  }

  // --- Delete ---

  async function handleDelete(docId: string) {
    try {
      const res = await fetch(`/api/missions/${missionId}/documents?documentId=${docId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchData()
      }
    } catch {
      setError('Erreur lors de la suppression du document.')
    }
  }

  async function handleBulkDelete(docIds: string[]) {
    try {
      const res = await fetch(
        `/api/missions/${missionId}/documents?documentIds=${docIds.join(',')}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        await fetchData()
      }
    } catch {
      setError('Erreur lors de la suppression des documents.')
    }
  }

  // --- Launch Analysis ---

  async function handleLaunchAnalysis() {
    setLaunchingAnalysis(true)
    setError(null)

    try {
      const res = await fetch(`/api/missions/${missionId}/analysis`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors du lancement de l'analyse.")
      }

      router.push(`/missions/${missionId}/analysis`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du lancement.')
      setLaunchingAnalysis(false)
    }
  }

  // --- Load Demo Documents ---

  async function handleLoadDemo() {
    setLoadingDemo(true)
    setError(null)

    try {
      const res = await fetch(`/api/missions/${missionId}/documents/demo`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors du chargement des documents de démonstration.')
      }

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement.')
    } finally {
      setLoadingDemo(false)
    }
  }

  // --- Completeness stats ---

  const requiredEntries = completeness.filter((c) => c.required)
  const presentRequired = requiredEntries.filter((c) => c.status === 'present').length
  const totalRequired = requiredEntries.length
  const completenessPercent = totalRequired > 0 ? Math.round((presentRequired / totalRequired) * 100) : 0

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      {/* Page header */}
      <MissionPageHeader
        missionId={missionId}
        mission={mission}
        title="Documents de la mission"
      />

      <DisclaimerBanner />

      {/* Mission-level analysis failure banner */}
      {mission?.status === 'analysis_failed' && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Échec de la pré-analyse
              </p>
              <p className="mt-1 text-sm text-destructive/80">
                La pré-analyse a échoué. Veuillez réessayer.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleLaunchAnalysis}
                loading={launchingAnalysis}
                disabled={documents.length === 0 || launchingAnalysis}
                iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Relancer la pré-analyse
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mission-level upload failure banner */}
      {mission?.status === 'upload_failed' && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Échec de l&apos;envoi des documents
              </p>
              <p className="mt-1 text-sm text-destructive/80">
                L&apos;envoi des documents a échoué. Veuillez réessayer.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleLaunchAnalysis}
                loading={launchingAnalysis}
                disabled={documents.length === 0 || launchingAnalysis}
                iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Relancer la pré-analyse
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Drag & Drop Upload Zone with staging */}
      <DropZone
        onUpload={handleUpload}
        uploading={uploading}
      />

      {/* Demo Documents Button (pointage + cutoff) */}
      {(mission?.scenario === 'pointage' || mission?.scenario === 'cutoff') && mission?.company_id && documents.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Documents de démonstration</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mission.scenario === 'cutoff'
                  ? 'Charger automatiquement le FEC, les factures et les bons de livraison/réception pour cette entreprise.'
                  : 'Charger automatiquement le bilan, le compte de résultat et l\u0027annexe pour cette entreprise.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              loading={loadingDemo}
              iconLeft={<Database className="h-4 w-4" />}
            >
              {loadingDemo ? 'Chargement...' : 'Charger les documents'}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {fileProgress.length > 0 && (
        <UploadProgress
          files={fileProgress}
          overallProgress={overallProgress}
          onCancel={uploading ? handleCancelUpload : undefined}
        />
      )}

      {/* Completeness Table */}
      {completeness.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-sm font-semibold text-card-foreground">Complétude documentaire</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {presentRequired}/{totalRequired} requis
                </span>
                <Badge variant={completenessPercent === 100 ? 'validated' : completenessPercent >= 50 ? 'to-investigate' : 'rejected'}>
                  {completenessPercent}%
                </Badge>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  completenessPercent === 100
                    ? 'bg-success'
                    : completenessPercent >= 50
                      ? 'bg-warning'
                      : 'bg-destructive'
                )}
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">Document</th>
                  <th className="px-5 py-2.5 text-center font-medium text-muted-foreground">Requis</th>
                  <th className="px-5 py-2.5 text-center font-medium text-muted-foreground">Reçu(s)</th>
                  <th className="px-5 py-2.5 text-center font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {completeness.map((entry) => (
                  <tr key={entry.doc_type} className="hover:bg-muted/50">
                    <td className="px-5 py-2.5 text-card-foreground">{entry.label}</td>
                    <td className="px-5 py-2.5 text-center text-muted-foreground">
                      {entry.required ? 'Oui' : 'Optionnel'}
                    </td>
                    <td className="px-5 py-2.5 text-center text-card-foreground">
                      {entry.count > 0 ? entry.count : '--'}
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      {statusBadge(entry.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Uploaded Documents List with bulk edit */}
      {documents.length > 0 && (
        <DocumentList
          documents={documents}
          missionId={missionId}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onPreview={setPreviewDoc}
          onRefresh={fetchData}
        />
      )}

      {/* Empty state */}
      {documents.length === 0 && !loading && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Aucun document envoyé</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Glissez vos fichiers dans la zone ci-dessus pour commencer.
          </p>
        </div>
      )}

      {/* Launch Analysis Button */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-card-foreground">Lancer la pré-analyse</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Les documents seront envoyés temporairement au serveur pour traitement, puis supprimés.
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={handleLaunchAnalysis}
            disabled={documents.length === 0 || launchingAnalysis}
            loading={launchingAnalysis}
            iconLeft={<Play className="h-4 w-4" />}
          >
            Lancer la pré-analyse
          </Button>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewDoc && (
        <PdfPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.filename}
          pdfUrl={`/api/missions/${missionId}/documents/${previewDoc.id}/preview`}
        />
      )}
    </div>
  )
}
