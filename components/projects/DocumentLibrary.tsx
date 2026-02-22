'use client'

import { useState, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Eye,
  Trash2,
  Tag,
  Upload,
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
  facture_vente: 'Factures de vente',
  facture_achat: 'Factures fournisseurs',
  bon_livraison: 'Bons de livraison',
  contrat: 'Contrats',
  annexe: 'Annexes',
  bilan: 'Bilans',
  compte_resultat: 'Comptes de resultat',
  autre: 'Autres',
}

const DOC_TYPE_ORDER: DocumentType[] = [
  'fec',
  'facture_vente',
  'facture_achat',
  'bon_livraison',
  'contrat',
  'bilan',
  'compte_resultat',
  'annexe',
  'autre',
]

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

interface DocumentLibraryProps {
  documents: LibraryDocument[]
  onPreview?: (doc: LibraryDocument) => void
  onDelete?: (doc: LibraryDocument) => void
  onReclassify?: (doc: LibraryDocument) => void
  onUpload?: () => void
  selectedDocId?: string | null
}

export default function DocumentLibrary({
  documents,
  onPreview,
  onDelete,
  onReclassify,
  onUpload,
  selectedDocId,
}: DocumentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

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

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="px-3 pb-2 pt-3">
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
            <p className="text-xs text-muted-foreground/60">Aucun resultat pour &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          DOC_TYPE_ORDER.map((type) => {
            const docs = groupedDocs[type]
            if (!docs || docs.length === 0) return null
            const isCollapsed = collapsedSections.has(type)

            return (
              <div key={type} className="mb-0.5">
                <button
                  onClick={() => toggleSection(type)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium transition-colors',
                    'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{DOC_TYPE_LABELS[type] || type}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">
                    {docs.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="ml-2 border-l border-border/50 pl-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className={cn(
                          'group flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors cursor-pointer',
                          selectedDocId === doc.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground/80 hover:bg-accent/40'
                        )}
                        onClick={() => onPreview?.(doc)}
                        title={`${doc.filename} (${formatFileSize(doc.file_size)})`}
                      >
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="min-w-0 truncate">{doc.filename}</span>

                        <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {onPreview && doc.filename.toLowerCase().endsWith('.pdf') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPreview(doc) }}
                              className="rounded p-0.5 hover:bg-accent"
                              title="Apercu"
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Upload button */}
      {onUpload && (
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
    </div>
  )
}
