'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Download, Loader2, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import { cn } from '@/lib/utils'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

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
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageWidth, setPageWidth] = useState(0)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use a ref for numPages in the keyboard handler to avoid re-registering the listener
  const numPagesRef = useRef(0)
  useEffect(() => { numPagesRef.current = numPages }, [numPages])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage((p) => Math.min(p + 1, numPagesRef.current))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage((p) => Math.max(p - 1, 1))
    },
    [onClose]
  )

  // Lock scroll + keyboard on open, reset state
  useEffect(() => {
    if (!isOpen) return
    setError(false)
    setCurrentPage(1)
    setNumPages(0)
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    const mainEl = document.querySelector('main')
    if (mainEl) (mainEl as HTMLElement).style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      if (mainEl) (mainEl as HTMLElement).style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  // Measure container width to fit PDF page
  useEffect(() => {
    if (!isOpen) return
    const measure = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.clientWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Viewer container */}
      <div
        className={cn(
          'relative z-10 flex flex-col isolate',
          'w-[94vw] h-[92vh]',
          'rounded-2xl bg-card shadow-2xl',
          'overflow-hidden ring-1 ring-black/10'
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
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

        {/* PDF scroll area */}
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto bg-[#f0f0f0]"
        >
          {/* Error state */}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-20">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Impossible de charger le document</p>
              <p className="text-xs text-muted-foreground/70">Essayez de le télécharger directement.</p>
            </div>
          )}

          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setError(true)}
            loading={
              <div className="flex items-center justify-center gap-3 py-20">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Chargement du document...</p>
              </div>
            }
            className="flex flex-col items-center gap-4 py-6"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={pageWidth ? pageWidth - 48 : undefined}
                className="shadow-lg"
                renderAnnotationLayer
                renderTextLayer
              />
            ))}
          </Document>
        </div>

        {/* Footer — page navigation */}
        {numPages > 1 && (
          <div className="flex flex-shrink-0 items-center justify-center gap-4 border-t border-border bg-card px-5 py-2.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} / {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
              disabled={currentPage === numPages}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
