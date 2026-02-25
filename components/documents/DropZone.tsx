'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { CloudUpload, Plus, FileText, Image, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// --- Types ---

export interface StagedFile {
  id: string
  file: File
  detectedType: string
}

interface DropZoneProps {
  onUpload: (files: StagedFile[]) => Promise<void>
  uploading: boolean
  disabled?: boolean
  acceptedExtensions?: string
}

// --- Constants ---

const documentTypeLabels: Record<string, string> = {
  fec: 'FEC',
  facture_vente: 'Facture de vente / avoir',
  facture_achat: 'Facture fournisseur',
  bon_livraison: 'Bon de livraison',
  bon_commande: 'Bon de commande',
  contrat: 'Contrat',
  annexe: 'Annexe',
  bilan: 'Bilan',
  compte_resultat: 'Compte de r\u00e9sultat',
  autre: 'Autre',
}

// --- Helpers ---

function autoDetectType(filename: string): string {
  const lower = filename.toLowerCase()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'txt' || ext === 'csv') return 'fec'
  if (lower.includes('fa-') || lower.includes('facture')) return 'facture_vente'
  if (lower.includes('frn-')) return 'facture_achat'
  if (lower.includes('bl-') || lower.includes('livraison')) return 'bon_livraison'
  if (lower.includes('br-') || lower.includes('reception')) return 'bon_livraison'
  if (lower.includes('bc-') || lower.includes('commande')) return 'bon_commande'
  if (lower.includes('av-') || lower.includes('avoir')) return 'facture_vente'
  if (lower.includes('bilan')) return 'bilan'
  if (lower.includes('resultat') || lower.includes('cr-')) return 'compte_resultat'
  if (lower.includes('annexe')) return 'annexe'
  if (lower.includes('contrat')) return 'contrat'
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

export default function DropZone({
  onUpload,
  uploading,
  disabled = false,
  acceptedExtensions = '.txt,.csv,.pdf,.jpg,.jpeg,.png,.tiff,.tif',
}: DropZoneProps) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevUploadingRef = useRef(uploading)

  // Clear staged files when uploading transitions from true to false
  useEffect(() => {
    if (prevUploadingRef.current && !uploading) {
      setStagedFiles([])
    }
    prevUploadingRef.current = uploading
  }, [uploading])

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

  const clearAll = useCallback(() => {
    setStagedFiles([])
  }, [])

  // --- Drag handlers ---

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setDragOver(true)
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
    if (disabled) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
    // Reset so the same file(s) can be re-selected
    e.target.value = ''
  }

  const isDisabled = disabled || uploading

  return (
    <div className="space-y-4">
      {/* Drop zone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all',
          isDisabled && 'pointer-events-none opacity-50',
          dragOver
            ? 'border-primary bg-primary/5 animate-pulse'
            : 'border-border bg-muted/30 hover:border-primary/20 hover:bg-primary/5'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedExtensions}
          onChange={handleFileInputChange}
          className="hidden"
        />
        {dragOver ? (
          <Plus className="mx-auto h-10 w-10 text-primary" />
        ) : (
          <CloudUpload className="mx-auto h-10 w-10 text-muted-foreground" />
        )}
        <p className="mt-3 text-sm font-medium text-card-foreground">
          Glissez vos documents ici
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ou cliquez pour s&eacute;lectionner &mdash; Formats : .txt, .pdf, .jpg, .png, .tiff
        </p>
      </div>

      {/* Staged files grid */}
      {stagedFiles.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stagedFiles.map((staged) => {
              const Icon = getFileIcon(staged.file.name)
              return (
                <div
                  key={staged.id}
                  className="relative rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFile(staged.id)}
                    disabled={uploading}
                    className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Retirer"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex items-start gap-3 pr-8">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="truncate text-sm font-medium text-card-foreground" title={staged.file.name}>
                        {staged.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(staged.file.size)}
                      </p>
                      <select
                        value={staged.detectedType}
                        onChange={(e) => updateType(staged.id, e.target.value)}
                        disabled={uploading}
                        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      >
                        {Object.entries(documentTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {stagedFiles.length} fichier{stagedFiles.length > 1 ? 's' : ''} pr&ecirc;t{stagedFiles.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={uploading}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onUpload(stagedFiles)}
                loading={uploading}
              >
                Envoyer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
