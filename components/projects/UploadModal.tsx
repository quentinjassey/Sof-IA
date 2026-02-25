'use client'

import { useState, useRef, useCallback } from 'react'
import { X, CloudUpload, Plus, FileText, Image, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentType } from '@/types/database'

// --- Types ---

interface StagedFile {
  id: string
  file: File
  detectedType: string
}

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (files: File[], types: string[], onProgress?: (pct: number) => void) => Promise<void>
}

// --- Constants ---

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'fec', label: 'FEC' },
  { value: 'facture_vente', label: 'Facture de vente / avoir' },
  { value: 'facture_achat', label: 'Facture fournisseur' },
  { value: 'bon_livraison', label: 'Bon de livraison' },
  { value: 'bon_commande', label: 'Bon de commande' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'bilan', label: 'Bilan' },
  { value: 'compte_resultat', label: 'Compte de résultat' },
  { value: 'annexe', label: 'Annexe' },
  { value: 'autre', label: 'Autre' },
]

// --- Helpers ---

function autoDetectType(filename: string): string {
  const lower = filename.toLowerCase()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'txt' || ext === 'csv') return 'fec'
  if (lower.includes('facture') && lower.includes('achat')) return 'facture_achat'
  if (lower.includes('frn-') || lower.includes('frn_')) return 'facture_achat'
  if (lower.includes('fa-') || lower.includes('fa_') || lower.includes('facture') || lower.includes('fac-')) return 'facture_vente'
  if (lower.includes('bl-') || lower.includes('bl_') || lower.includes('livraison')) return 'bon_livraison'
  if (lower.includes('br-') || lower.includes('br_') || lower.includes('reception')) return 'bon_livraison'
  if (lower.includes('bc-') || lower.includes('bc_') || lower.includes('commande')) return 'bon_commande'
  if (lower.includes('av-') || lower.includes('avoir')) return 'facture_vente'
  if (lower.includes('bilan')) return 'bilan'
  if (lower.includes('resultat') || lower.includes('cr-')) return 'compte_resultat'
  if (lower.includes('annexe')) return 'annexe'
  if (lower.includes('contrat') || lower.includes('ct-')) return 'contrat'
  return 'autre'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'tiff' || ext === 'tif') {
    return Image
  }
  return FileText
}

// --- Component ---

export default function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadDone, setUploadDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList)
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.file.name))
      const deduped = newFiles.filter((f) => !existingNames.has(f.name))
      const staged: StagedFile[] = deduped.map((file) => ({
        id: crypto.randomUUID(),
        file,
        detectedType: autoDetectType(file.name),
      }))
      return [...prev, ...staged]
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const updateType = useCallback((id: string, newType: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, detectedType: newType } : f))
    )
  }, [])

  const handleClose = () => {
    if (uploading) return
    setStagedFiles([])
    setDragOver(false)
    setProgress(0)
    setUploadDone(false)
    onClose()
  }

  const handleUpload = async () => {
    if (stagedFiles.length === 0) return
    setUploading(true)
    setProgress(0)
    setUploadDone(false)
    try {
      await onUpload(
        stagedFiles.map((sf) => sf.file),
        stagedFiles.map((sf) => sf.detectedType),
        (pct) => setProgress(pct)
      )
      setProgress(100)
      setUploadDone(true)
      await new Promise((r) => setTimeout(r, 600))
      setStagedFiles([])
      setProgress(0)
      setUploadDone(false)
      onClose()
    } finally {
      setUploading(false)
    }
  }

  // Drag handlers
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
      addFiles(e.dataTransfer.files)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
    e.target.value = ''
  }

  if (!isOpen) return null

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/10 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-serif text-lg text-card-foreground">Ajouter des documents</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Glissez vos fichiers ou cliquez pour les sélectionner
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content — upload progress replaces file list */}
        {uploading ? (
          <div className="px-6 py-8 space-y-5">
            {/* Upload icon */}
            <div className="flex justify-center">
              {uploadDone ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <CheckCircle className="h-7 w-7 text-success" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <CloudUpload className="h-7 w-7 text-primary" />
                </div>
              )}
            </div>

            {/* Label + percentage */}
            <div className="text-center">
              <p className="text-sm font-medium text-card-foreground">
                {uploadDone ? 'Envoi terminé' : 'Envoi en cours...'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stagedFiles.length} fichier{stagedFiles.length > 1 ? 's' : ''} — {formatFileSize(totalSize)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300 ease-out',
                    uploadDone ? 'bg-success' : 'bg-primary'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm font-semibold tabular-nums text-card-foreground">
                {Math.round(progress)}%
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Normal staging content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'cursor-pointer rounded-xl border-2 border-dashed transition-all',
                  stagedFiles.length > 0 ? 'px-4 py-4' : 'px-6 py-8',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/5'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.csv,.pdf,.jpg,.jpeg,.png,.tiff,.tif"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="text-center">
                  {dragOver ? (
                    <Plus className="mx-auto h-8 w-8 text-primary" />
                  ) : (
                    <CloudUpload className={cn(
                      'mx-auto text-muted-foreground',
                      stagedFiles.length > 0 ? 'h-6 w-6' : 'h-10 w-10'
                    )} />
                  )}
                  <p className={cn(
                    'font-medium text-card-foreground',
                    stagedFiles.length > 0 ? 'mt-1.5 text-xs' : 'mt-3 text-sm'
                  )}>
                    {stagedFiles.length > 0 ? 'Ajouter d\u0027autres fichiers' : 'Glissez vos documents ici'}
                  </p>
                  {stagedFiles.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      ou cliquez pour sélectionner — .txt, .csv, .pdf, .jpg, .png, .tiff
                    </p>
                  )}
                </div>
              </div>

              {/* Staged files list */}
              {stagedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {stagedFiles.length} fichier{stagedFiles.length > 1 ? 's' : ''} — {formatFileSize(totalSize)}
                  </p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {stagedFiles.map((staged) => {
                      const Icon = getFileIcon(staged.file.name)
                      return (
                        <div
                          key={staged.id}
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 group"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-card-foreground" title={staged.file.name}>
                              {staged.file.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(staged.file.size)}
                            </p>
                          </div>

                          <select
                            value={staged.detectedType}
                            onChange={(e) => updateType(staged.id, e.target.value)}
                            className={cn(
                              'h-7 shrink-0 rounded-md border border-border bg-card px-2 text-[10px] text-card-foreground',
                              'focus:outline-none focus:ring-1 focus:ring-primary',
                              'cursor-pointer'
                            )}
                          >
                            {DOC_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => removeFile(staged.id)}
                            className="shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            title="Retirer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {stagedFiles.length === 0
                    ? 'Aucun fichier sélectionné'
                    : `${stagedFiles.length} fichier${stagedFiles.length > 1 ? 's' : ''} prêt${stagedFiles.length > 1 ? 's' : ''}`}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClose}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={stagedFiles.length === 0}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all',
                      'bg-primary text-primary-foreground shadow-sm',
                      'hover:brightness-110 disabled:opacity-50'
                    )}
                  >
                    <CloudUpload className="h-4 w-4" />
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
