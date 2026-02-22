'use client'

import { useState } from 'react'
import { X, Tag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentType } from '@/types/database'

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'fec', label: 'Fichier des Ecritures Comptables (FEC)' },
  { value: 'facture_vente', label: 'Facture de vente' },
  { value: 'facture_achat', label: 'Facture fournisseur' },
  { value: 'bon_livraison', label: 'Bon de livraison / reception' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'bilan', label: 'Bilan' },
  { value: 'compte_resultat', label: 'Compte de resultat' },
  { value: 'annexe', label: 'Annexe aux comptes annuels' },
  { value: 'autre', label: 'Autre document' },
]

interface ReclassifyDialogProps {
  isOpen: boolean
  onClose: () => void
  documentName: string
  currentType: DocumentType
  onConfirm: (newType: DocumentType) => Promise<void>
}

export default function ReclassifyDialog({
  isOpen,
  onClose,
  documentName,
  currentType,
  onConfirm,
}: ReclassifyDialogProps) {
  const [selectedType, setSelectedType] = useState<DocumentType>(currentType)
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (selectedType === currentType) {
      onClose()
      return
    }
    setIsSaving(true)
    try {
      await onConfirm(selectedType)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h3 className="font-serif text-lg text-card-foreground">Reclassifier le document</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Fichier : <span className="font-medium text-foreground">{documentName}</span>
        </p>

        <div className="mb-6 space-y-1.5">
          {DOC_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedType(opt.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
                selectedType === opt.value
                  ? 'bg-primary/10 text-primary font-medium border border-primary/30'
                  : 'text-foreground hover:bg-accent/50 border border-transparent'
              )}
            >
              <span className={cn(
                'h-2 w-2 rounded-full shrink-0',
                selectedType === opt.value ? 'bg-primary' : 'bg-border'
              )} />
              {opt.label}
              {opt.value === currentType && (
                <span className="ml-auto text-[10px] text-muted-foreground">(actuel)</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || selectedType === currentType}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm',
              'hover:brightness-110 disabled:opacity-50'
            )}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Reclassifier
          </button>
        </div>
      </div>
    </div>
  )
}
