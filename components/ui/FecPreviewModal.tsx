'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Table2, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FecPreviewData {
  filename: string
  headers: string[]
  rows: string[][]
  totalLines: number
  previewLimit: number
  truncated: boolean
}

interface FecPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  previewUrl: string
  downloadUrl?: string
}

const COLUMN_LABELS: Record<string, string> = {
  journalcode: 'Journal',
  journallib: 'Libellé journal',
  ecriturenum: 'N° écriture',
  ecrituredate: 'Date écriture',
  comptenum: 'N° compte',
  comptelib: 'Libellé compte',
  compauxnum: 'Aux. N°',
  compauxlib: 'Aux. Lib.',
  pieceref: 'Réf. pièce',
  piecedate: 'Date pièce',
  ecriturelib: 'Libellé',
  debit: 'Débit',
  credit: 'Crédit',
  ecritureletter: 'Lettrage',
  datelet: 'Date lettrage',
  validdate: 'Date valid.',
  montantdevise: 'Devise',
  idevise: 'Code devise',
}

function friendlyHeader(raw: string): string {
  return COLUMN_LABELS[raw.toLowerCase()] || raw
}

function isNumericColumn(header: string): boolean {
  const lower = header.toLowerCase()
  return ['debit', 'credit', 'montantdevise'].includes(lower)
}

function formatCellValue(value: string, header: string): string {
  if (!value || value.trim() === '') return '—'
  if (isNumericColumn(header)) {
    const num = parseFloat(value.replace(',', '.').replace(/\s/g, ''))
    if (!isNaN(num)) {
      return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }
  return value
}

export function FecPreviewModal({
  isOpen,
  onClose,
  title,
  previewUrl,
  downloadUrl,
}: FecPreviewModalProps) {
  const [data, setData] = useState<FecPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    setData(null)
    setError(null)
    setLoading(true)

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    const mainEl = document.querySelector('main')
    if (mainEl) (mainEl as HTMLElement).style.overflow = 'hidden'

    fetch(previewUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error('Impossible de charger le fichier.')
        const json = await res.json()
        setData(json.data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (mainEl) (mainEl as HTMLElement).style.overflow = ''
    }
  }, [isOpen, previewUrl, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className={cn(
          'relative z-10 flex flex-col isolate',
          'w-[96vw] h-[92vh]',
          'rounded-2xl bg-card shadow-2xl',
          'overflow-hidden ring-1 ring-black/10'
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Table2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              {data && (
                <p className="text-xs text-muted-foreground">
                  {data.truncated
                    ? `Aperçu des ${data.previewLimit} premières écritures sur ${data.totalLines.toLocaleString('fr-FR')}`
                    : `${data.totalLines.toLocaleString('fr-FR')} écriture${data.totalLines > 1 ? 's' : ''}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement du FEC…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AlertCircle className="h-10 w-10 text-destructive/40" />
              <p className="text-sm font-medium text-muted-foreground">{error}</p>
            </div>
          )}

          {data && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap w-10">
                    #
                  </th>
                  {data.headers.map((h, i) => (
                    <th
                      key={i}
                      className={cn(
                        'px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap',
                        isNumericColumn(h) ? 'text-right' : 'text-left'
                      )}
                    >
                      {friendlyHeader(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn(
                      'transition-colors hover:bg-muted/50',
                      ri % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                    )}
                  >
                    <td className="px-3 py-1.5 text-center text-muted-foreground tabular-nums">
                      {ri + 1}
                    </td>
                    {data.headers.map((h, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          'px-3 py-1.5 whitespace-nowrap',
                          isNumericColumn(h)
                            ? 'text-right tabular-nums font-mono'
                            : 'text-left'
                        )}
                      >
                        {formatCellValue(row[ci] || '', h)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {data?.truncated && (
          <div className="flex flex-shrink-0 items-center justify-center border-t border-border bg-muted/50 px-5 py-2.5">
            <p className="text-xs text-muted-foreground">
              Affichage limité aux {data.previewLimit} premières lignes — le fichier complet contient{' '}
              {data.totalLines.toLocaleString('fr-FR')} écritures
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
