'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Download, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PdfPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  pdfUrl: string
  downloadUrl?: string
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  pdfUrl,
  downloadUrl,
}: PdfPreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(false)
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay — covers everything including sidebar */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Viewer container */}
      <div
        className={cn(
          'relative z-10 flex flex-col',
          'w-[94vw] h-[92vh]',
          'rounded-2xl border border-border/50 bg-card shadow-2xl',
          'overflow-hidden'
        )}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h2 className="truncate text-sm font-semibold text-foreground">
              {title}
            </h2>
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

        {/* PDF content area */}
        <div className="relative flex-1 bg-muted/30">
          {/* Loading state */}
          {loading && !error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Chargement du document...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Impossible de charger le document
              </p>
              <p className="text-xs text-muted-foreground/70">
                Essayez de le télécharger directement.
              </p>
            </div>
          )}

          {/* PDF iframe — append #toolbar=0 to hide the Chrome PDF toolbar */}
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className="h-full w-full"
            title={title}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        </div>
      </div>
    </div>
  )
}
