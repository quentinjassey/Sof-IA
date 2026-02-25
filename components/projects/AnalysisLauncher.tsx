'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Play, Loader2, FileText, CheckSquare, Square, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScenarioType, DocumentType } from '@/types/database'
import { type LibraryDocument } from './DocumentLibrary'

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage etats financiers / annexe',
}

const SCENARIO_REQUIRED_TYPES: Record<ScenarioType, DocumentType[]> = {
  sondage_ca: ['fec', 'facture_vente', 'bon_livraison'],
  cutoff: ['fec', 'facture_vente', 'facture_achat', 'bon_livraison'],
  pointage: ['bilan', 'compte_resultat', 'annexe'],
}

const SCENARIO_OPTIONAL_TYPES: Record<ScenarioType, DocumentType[]> = {
  sondage_ca: ['contrat'],
  cutoff: ['contrat'],
  pointage: [],
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  fec: 'FEC',
  facture_vente: 'Facture de vente',
  facture_achat: 'Facture fournisseur',
  bon_livraison: 'Bon de livraison',
  contrat: 'Contrat',
  annexe: 'Annexe',
  bilan: 'Bilan',
  compte_resultat: 'Compte de resultat',
  autre: 'Autre',
}

interface AnalysisLauncherProps {
  isOpen: boolean
  onClose: () => void
  scenario: ScenarioType
  documents: LibraryDocument[]
  onConfirm: (documentIds: string[]) => Promise<void>
}

export default function AnalysisLauncher({
  isOpen,
  onClose,
  scenario,
  documents,
  onConfirm,
}: AnalysisLauncherProps) {
  const requiredTypes = SCENARIO_REQUIRED_TYPES[scenario]
  const optionalTypes = SCENARIO_OPTIONAL_TYPES[scenario]

  const relevantTypes = useMemo(
    () => [...requiredTypes, ...optionalTypes],
    [requiredTypes, optionalTypes]
  )

  const relevantDocs = useMemo(
    () => documents.filter((d) => relevantTypes.includes(d.type)),
    [documents, relevantTypes]
  )

  const otherDocs = useMemo(
    () => documents.filter((d) => !relevantTypes.includes(d.type)),
    [documents, relevantTypes]
  )

  const relevantDocIds = useMemo(
    () => relevantDocs.map((d) => d.id).join(','),
    [relevantDocs]
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLaunching, setIsLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(relevantDocIds ? relevantDocIds.split(',') : []))
      setError(null)
    }
  }, [isOpen, relevantDocIds])

  if (!isOpen) return null

  const toggleDoc = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const missingRequired = requiredTypes.filter(
    (type) => !relevantDocs.some((d) => d.type === type && selectedIds.has(d.id))
  )

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      setError('Selectionnez au moins un document.')
      return
    }
    setIsLaunching(true)
    setError(null)
    try {
      await onConfirm(Array.from(selectedIds))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du lancement.')
    } finally {
      setIsLaunching(false)
    }
  }

  const renderDocRow = (doc: LibraryDocument) => {
    const isSelected = selectedIds.has(doc.id)
    return (
      <button
        key={doc.id}
        onClick={() => toggleDoc(doc.id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all',
          isSelected
            ? 'bg-primary/5 text-foreground'
            : 'text-muted-foreground hover:bg-accent/30'
        )}
      >
        {isSelected ? (
          <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Square className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        )}
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate">{doc.filename}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">
          {DOC_TYPE_LABELS[doc.type]}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-serif text-lg text-card-foreground">Lancer l&apos;analyse</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{SCENARIO_LABELS[scenario]}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Sof&apos;IA a pre-selectionne les documents pertinents pour cette analyse.
            Vous pouvez modifier cette selection avant de lancer.
          </p>

          {missingRequired.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
              <div className="text-xs text-warning-foreground">
                <p className="font-medium">Documents requis manquants :</p>
                <p>{missingRequired.map((t) => DOC_TYPE_LABELS[t]).join(', ')}</p>
              </div>
            </div>
          )}

          {relevantDocs.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Documents pertinents ({relevantDocs.length})
              </h4>
              <div className="space-y-0.5">
                {relevantDocs.map(renderDocRow)}
              </div>
            </div>
          )}

          {otherDocs.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Autres documents ({otherDocs.length})
              </h4>
              <div className="space-y-0.5">
                {otherDocs.map(renderDocRow)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          {error && (
            <div className="mb-3 flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selectionne{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLaunching || selectedIds.size === 0}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all',
                  'bg-primary text-primary-foreground shadow-sm',
                  'hover:brightness-110 disabled:opacity-50'
                )}
              >
                {isLaunching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Lancer la pre-analyse
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
