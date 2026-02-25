'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Eye,
  Trash2,
  Tag,
  Upload,
  CheckSquare,
  Square,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentType } from '@/types/database'

export interface LibraryDocument {
  id: string
  type: DocumentType
  filename: string
  file_size: number | null
  added_at: string
  storage_path: string
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  fec: 'FEC',
  facture_vente: 'Factures de vente et avoirs',
  facture_achat: 'Factures fournisseurs',
  bon_livraison: 'Bons de livraison',
  bon_commande: 'Bons de commande',
  contrat: 'Contrats',
  annexe: 'Annexes',
  bilan: 'Bilans',
  compte_resultat: 'Comptes de résultat',
  autre: 'Autres',
}

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'fec', label: 'FEC' },
  { value: 'facture_vente', label: 'Facture de vente' },
  { value: 'facture_achat', label: 'Facture fournisseur' },
  { value: 'bon_livraison', label: 'Bon de livraison' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'bilan', label: 'Bilan' },
  { value: 'compte_resultat', label: 'Compte de résultat' },
  { value: 'annexe', label: 'Annexe' },
  { value: 'autre', label: 'Autre' },
]

const DOC_TYPE_ORDER: DocumentType[] = [
  'fec',
  'facture_vente',
  'facture_achat',
  'bon_livraison',
  'bon_commande',
  'contrat',
  'bilan',
  'compte_resultat',
  'annexe',
  'autre',
]

interface DocumentLibraryProps {
  documents: LibraryDocument[]
  onPreview?: (doc: LibraryDocument) => void
  onDelete?: (doc: LibraryDocument) => void
  onBulkDelete?: (docIds: string[]) => Promise<void>
  onBulkReclassify?: (docIds: string[], newType: DocumentType) => Promise<void>
  onReclassify?: (doc: LibraryDocument) => void
  onUpload?: () => void
  selectedDocId?: string | null
}

export default function DocumentLibrary({
  documents,
  onPreview,
  onDelete,
  onBulkDelete,
  onBulkReclassify,
  onReclassify,
  onUpload,
  selectedDocId,
}: DocumentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkReclassifying, setBulkReclassifying] = useState(false)

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase()
    return documents.filter((d) => d.filename.toLowerCase().includes(q))
  }, [documents, searchQuery])

  const groupedDocs = useMemo(() => {
    const groups: Record<string, LibraryDocument[]> = {}
    for (const doc of filteredDocs) {
      if (!groups[doc.type]) groups[doc.type] = []
      groups[doc.type].push(doc)
    }
    return groups
  }, [filteredDocs])

  const toggleSection = (type: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Selection handlers
  const toggleDoc = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGroup = useCallback((docs: LibraryDocument[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const groupIds = docs.map((d) => d.id)
      const allSelected = groupIds.every((id) => prev.has(id))
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id))
      } else {
        groupIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredDocs.map((d) => d.id)))
  }, [filteredDocs])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
  }, [])

  const enterSelection = useCallback(() => {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }, [])

  // Bulk actions
  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || selectedIds.size === 0) return
    setBulkDeleting(true)
    try {
      await onBulkDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
      setSelectionMode(false)
    } finally {
      setBulkDeleting(false)
    }
  }, [onBulkDelete, selectedIds])

  const handleBulkReclassify = useCallback(async (newType: DocumentType) => {
    if (!onBulkReclassify || selectedIds.size === 0) return
    setBulkReclassifying(true)
    try {
      await onBulkReclassify(Array.from(selectedIds), newType)
      setSelectedIds(new Set())
      setSelectionMode(false)
    } finally {
      setBulkReclassifying(false)
    }
  }, [onBulkReclassify, selectedIds])

  const allSelected = filteredDocs.length > 0 && selectedIds.size === filteredDocs.length
  const hasBulkActions = onBulkDelete || onBulkReclassify

  return (
    <div className="flex h-full flex-col">
      {/* Search + selection toggle */}
      <div className="px-3 pb-2 pt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className={cn(
              'w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground',
              'placeholder:text-muted-foreground/40',
              'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20'
            )}
          />
        </div>

        {hasBulkActions && documents.length > 0 && (
          selectionMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={allSelected ? deselectAll : selectAll}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                  'bg-primary/10 text-primary hover:bg-primary/15'
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {allSelected ? 'Tout décocher' : 'Tout cocher'}
              </button>
              <button
                onClick={exitSelection}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={enterSelection}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                'border border-border text-muted-foreground',
                'hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
              )}
            >
              <CheckSquare className="h-3 w-3" />
              Sélection multiple
            </button>
          )
        )}
      </div>

      {/* Document tree */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <FileText className="mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">Aucun document</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground/60">Aucun résultat pour &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          DOC_TYPE_ORDER.map((type) => {
            const docs = groupedDocs[type]
            if (!docs || docs.length === 0) return null
            const isCollapsed = collapsedSections.has(type)
            const groupAllSelected = selectionMode && docs.every((d) => selectedIds.has(d.id))
            const groupSomeSelected = selectionMode && docs.some((d) => selectedIds.has(d.id))

            return (
              <div key={type} className="mb-0.5">
                <button
                  onClick={() => selectionMode ? toggleGroup(docs) : toggleSection(type)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium transition-colors',
                    'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {selectionMode ? (
                    groupAllSelected ? (
                      <CheckSquare className="h-3 w-3 shrink-0 text-primary" />
                    ) : groupSomeSelected ? (
                      <div className="relative h-3 w-3 shrink-0">
                        <Square className="h-3 w-3 text-primary" />
                        <div className="absolute inset-0.5 rounded-[1px] bg-primary/40" />
                      </div>
                    ) : (
                      <Square className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    )
                  ) : isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{DOC_TYPE_LABELS[type] || type}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">
                    {docs.length}
                  </span>
                </button>

                {(selectionMode || !isCollapsed) && (
                  <div className="ml-2 border-l border-border/50 pl-2">
                    {docs.map((doc) => {
                      const isSelected = selectedIds.has(doc.id)
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            'group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer',
                            selectionMode && isSelected
                              ? 'bg-primary/10 text-primary'
                              : selectedDocId === doc.id
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground/80 hover:bg-accent/40'
                          )}
                          onClick={() => selectionMode ? toggleDoc(doc.id) : onPreview?.(doc)}
                        >
                          {selectionMode ? (
                            isSelected ? (
                              <CheckSquare className="h-3 w-3 shrink-0 text-primary" />
                            ) : (
                              <Square className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                            )
                          ) : (
                            <FileText className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                          )}
                          <span className="min-w-0 truncate">{doc.filename}</span>

                          {!selectionMode && (
                            <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {onPreview && (doc.filename.toLowerCase().endsWith('.pdf') || doc.type === 'fec') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onPreview(doc) }}
                                  className="rounded p-0.5 hover:bg-accent"
                                  title="Aperçu"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              )}
                              {onReclassify && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onReclassify(doc) }}
                                  className="rounded p-0.5 hover:bg-accent"
                                  title="Reclassifier"
                                >
                                  <Tag className="h-3 w-3" />
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDelete(doc) }}
                                  className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Bulk action bar (slides up when docs selected) */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out border-t border-border',
          selectionMode && selectedIds.size > 0
            ? 'max-h-32 opacity-100'
            : 'max-h-0 opacity-0 border-t-0'
        )}
      >
        <div className="bg-muted/50 px-3 py-2 space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5">
            {onBulkReclassify && (
              <select
                disabled={bulkReclassifying}
                value=""
                onChange={(e) => handleBulkReclassify(e.target.value as DocumentType)}
                className={cn(
                  'h-7 flex-1 rounded-md border border-border bg-card px-2 text-[10px] text-card-foreground',
                  'focus:outline-none focus:ring-1 focus:ring-primary',
                  'disabled:opacity-50 appearance-none cursor-pointer'
                )}
              >
                <option value="" disabled>
                  {bulkReclassifying ? 'En cours...' : 'Reclassifier...'}
                </option>
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {onBulkDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  'bg-destructive/10 text-destructive hover:bg-destructive/20'
                )}
              >
                <Trash2 className="h-3 w-3" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload button (hidden in selection mode) */}
      {onUpload && !selectionMode && (
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={onUpload}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors',
              'border border-dashed border-border text-muted-foreground',
              'hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Ajouter des documents
          </button>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px]"
            onClick={() => !bulkDeleting && setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl mx-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Supprimer {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} ?
                </h3>
                <div className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
                  {documents
                    .filter((d) => selectedIds.has(d.id))
                    .slice(0, 8)
                    .map((doc) => (
                      <p key={doc.id} className="text-[10px] text-muted-foreground truncate">
                        {doc.filename}
                      </p>
                    ))}
                  {selectedIds.size > 8 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{selectedIds.size - 8} autre{selectedIds.size - 8 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Cette action est irréversible.
                </p>
              </div>
              <button
                onClick={() => !bulkDeleting && setShowDeleteConfirm(false)}
                className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-card-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDeleting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  'bg-destructive text-destructive-foreground',
                  'hover:brightness-110 disabled:opacity-50'
                )}
              >
                {bulkDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
