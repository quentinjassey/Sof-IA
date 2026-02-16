'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  FolderOpen,
  RefreshCw,
  Database,
  Eye,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

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

const documentTypeLabels: Record<string, string> = {
  fec: 'FEC',
  facture_vente: 'Facture de vente',
  facture_achat: 'Facture fournisseur',
  bon_livraison: 'Bon de livraison',
  contrat: 'Contrat',
  annexe: 'Annexe',
  bilan: 'Bilan',
  compte_resultat: 'Compte de résultat',
  autre: 'Autre',
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [launchingAnalysis, setLaunchingAnalysis] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // --- Upload ---

  async function handleUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    const formData = new FormData()
    const fileArray = Array.from(files)

    fileArray.forEach((file) => {
      formData.append('files', file)
      // Auto-detect type based on extension
      const ext = file.name.split('.').pop()?.toLowerCase()
      let docType = 'autre'
      if (ext === 'txt' || ext === 'csv') docType = 'fec'
      else if (ext === 'pdf') {
        const nameLower = file.name.toLowerCase()
        if (nameLower.includes('fa-') || nameLower.includes('facture')) docType = 'facture_vente'
        else if (nameLower.includes('bl-') || nameLower.includes('livraison')) docType = 'bon_livraison'
        else if (nameLower.includes('bilan')) docType = 'bilan'
        else if (nameLower.includes('resultat') || nameLower.includes('cr-')) docType = 'compte_resultat'
        else if (nameLower.includes('annexe')) docType = 'annexe'
        else if (nameLower.includes('contrat')) docType = 'contrat'
      }
      formData.append('types', docType)
    })

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90))
    }, 300)

    try {
      const res = await fetch(`/api/missions/${missionId}/documents`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de l'envoi des documents.")
      }

      // Refresh data
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.")
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  // --- Drag & Drop ---

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
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

  // --- Load Demo Documents (pointage only) ---

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

      // Refresh data
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
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Documents de la mission</h1>
        {mission && (
          <p className="mt-1 text-sm text-muted-foreground">
            {mission.name} — {mission.scenario === 'sondage_ca' ? 'Sondage sur le chiffre d\'affaires' : mission.scenario === 'cutoff' ? 'Césure d\'exercice (cut-off)' : 'Pointage des états financiers'}
          </p>
        )}
      </div>

      <DisclaimerBanner />

      {/* Mission-level analysis failure banner (shown when user returns from analysis page) */}
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

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          dragOver
            ? 'border-primary/30 bg-primary/5'
            : 'border-border bg-muted/30 hover:border-primary/20 hover:bg-primary/5'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.csv,.pdf"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />
        <Upload className={cn('mx-auto h-10 w-10', dragOver ? 'text-primary' : 'text-muted-foreground')} />
        <p className="mt-3 text-sm font-medium text-card-foreground">
          Glissez vos documents ici
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ou cliquez pour sélectionner — Formats acceptés : .txt (FEC), .pdf
        </p>
      </div>

      {/* Demo Documents Button (pointage only) */}
      {mission?.scenario === 'pointage' && mission?.company_id && documents.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Documents de démonstration</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Charger automatiquement le bilan, le compte de résultat et l&apos;annexe pour cette entreprise.
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
      {uploading && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-primary">Envoi en cours...</span>
            <span className="text-primary">{uploadProgress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
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
            {/* Progress bar */}
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

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="font-serif text-sm font-semibold text-card-foreground">
              Documents envoyés ({documents.length})
            </h2>
          </div>

          <ul className="divide-y divide-border/50">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {documentTypeLabels[doc.type] || doc.type} — {formatFileSize(doc.file_size)} — {new Date(doc.added_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {doc.filename?.toLowerCase().endsWith('.pdf') && (
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Aperçu"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
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
