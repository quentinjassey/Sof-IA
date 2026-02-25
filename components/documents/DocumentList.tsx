'use client'

import { useState, useCallback } from 'react'
import {
  FileText,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
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

interface DocumentListProps {
  documents: UploadedDocument[]
  missionId: string
  onDelete: (docId: string) => Promise<void>
  onBulkDelete: (docIds: string[]) => Promise<void>
  onPreview: (doc: UploadedDocument) => void
  onRefresh: () => Promise<void>
}

// --- Helpers ---

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

const documentTypeOptions = Object.entries(documentTypeLabels)

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// --- Component ---

export function DocumentList({
  documents,
  missionId,
  onDelete,
  onBulkDelete,
  onPreview,
  onRefresh,
}: DocumentListProps) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [changingType, setChangingType] = useState(false)
  const [deletingSingle, setDeletingSingle] = useState<string | null>(null)

  // --- Selection ---

  const toggleSelection = useCallback((docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)))
    }
  }, [selectedIds.size, documents])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }, [])

  // --- Bulk Type Change ---

  async function handleBulkTypeChange(newType: string) {
    if (!newType || selectedIds.size === 0) return
    setChangingType(true)
    try {
      const res = await fetch(`/api/missions/${missionId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          type: newType,
        }),
      })
      if (res.ok) {
        await onRefresh()
        setSelectedIds(new Set())
      }
    } finally {
      setChangingType(false)
    }
  }

  // --- Bulk Delete ---

  async function handleBulkDeleteConfirm() {
    setBulkDeleting(true)
    try {
      await onBulkDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
      setShowDeleteModal(false)
      setSelectionMode(false)
    } finally {
      setBulkDeleting(false)
    }
  }

  // --- Single Delete ---

  async function handleSingleDelete(docId: string) {
    setDeletingSingle(docId)
    try {
      await onDelete(docId)
    } finally {
      setDeletingSingle(null)
    }
  }

  // --- Derived ---

  const selectedDocs = documents.filter((d) => selectedIds.has(d.id))
  const allSelected = documents.length > 0 && selectedIds.size === documents.length

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-sm font-semibold text-card-foreground">
            Documents envoyés ({documents.length})
          </h2>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {allSelected ? 'Désélectionner' : 'Sélectionner tout'}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitSelectionMode}
                >
                  Annuler
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={enterSelectionMode}
              >
                Sélection
              </Button>
            )}
          </div>
        </div>
        {selectionMode && selectedIds.size > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Document Rows */}
      <ul className="divide-y divide-border/50">
        {documents.map((doc) => {
          const isSelected = selectedIds.has(doc.id)
          const isDeleting = deletingSingle === doc.id

          return (
            <li
              key={doc.id}
              onClick={selectionMode ? () => toggleSelection(doc.id) : undefined}
              className={cn(
                'flex items-center justify-between px-5 py-3 transition-colors',
                selectionMode ? 'cursor-pointer' : '',
                isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <div className="flex items-center gap-3">
                {selectionMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelection(doc.id)
                    }}
                    className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4.5 w-4.5 text-primary" />
                    ) : (
                      <Square className="h-4.5 w-4.5" />
                    )}
                  </button>
                )}
                <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-card-foreground">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {documentTypeLabels[doc.type] || doc.type} — {formatFileSize(doc.file_size)} — {new Date(doc.added_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {!selectionMode && (
                <div className="flex items-center gap-1">
                  {doc.filename?.toLowerCase().endsWith('.pdf') && (
                    <button
                      onClick={() => onPreview(doc)}
                      className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Aperçu"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleSingleDelete(doc.id)}
                    disabled={isDeleting}
                    className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Supprimer"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Bulk Action Toolbar */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          selectionMode && selectedIds.size > 0
            ? 'max-h-20 opacity-100'
            : 'max-h-0 opacity-0'
        )}
      >
        <div className="flex items-center justify-between border-t border-border bg-muted/50 backdrop-blur-sm px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3">
            {/* Type change dropdown */}
            <div className="relative">
              <select
                disabled={changingType}
                value=""
                onChange={(e) => handleBulkTypeChange(e.target.value)}
                className={cn(
                  'h-8 rounded-lg border border-border bg-card px-3 pr-8 text-xs text-card-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'appearance-none cursor-pointer'
                )}
              >
                <option value="" disabled>
                  {changingType ? 'Modification...' : 'Changer le type...'}
                </option>
                {documentTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk delete button */}
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            >
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !bulkDeleting && setShowDeleteModal(false)}
          />

          {/* Card */}
          <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Supprimer {selectedDocs.length} document{selectedDocs.length > 1 ? 's' : ''} ?
                </h3>
                <div className="mt-2 space-y-1">
                  {selectedDocs.slice(0, 5).map((doc) => (
                    <p key={doc.id} className="text-xs text-muted-foreground truncate">
                      {doc.filename}
                    </p>
                  ))}
                  {selectedDocs.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{selectedDocs.length - 5} autre{selectedDocs.length - 5 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Cette action est irréversible.
                </p>
              </div>
              <button
                onClick={() => !bulkDeleting && setShowDeleteModal(false)}
                className="flex-shrink-0 rounded-lg p-1 text-muted-foreground hover:text-card-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={bulkDeleting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDeleteConfirm}
                loading={bulkDeleting}
                iconLeft={<Trash2 className="h-3.5 w-3.5" />}
              >
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
