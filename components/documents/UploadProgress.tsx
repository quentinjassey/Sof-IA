'use client'

import { Loader2, CheckCircle, XCircle, Clock, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/utils/format'
import { Button } from '@/components/ui/Button'

export interface FileProgress {
  id: string
  filename: string
  size: number
  progress: number // 0-100
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

interface UploadProgressProps {
  files: FileProgress[]
  overallProgress: number
  onCancel?: () => void
  onRetry?: (fileId: string) => void
}

const statusIcons = {
  pending: <Clock className="size-4 text-muted-foreground" />,
  uploading: <Loader2 className="size-4 animate-spin text-primary" />,
  complete: <CheckCircle className="size-4 text-emerald-600" />,
  error: <XCircle className="size-4 text-destructive" />,
}

export function UploadProgress({ files, overallProgress, onCancel, onRetry }: UploadProgressProps) {
  if (files.length === 0) return null

  const allComplete = files.every((f) => f.status === 'complete')
  const hasErrors = files.some((f) => f.status === 'error')
  const completedCount = files.filter((f) => f.status === 'complete').length
  const totalSent = files.reduce(
    (acc, f) => acc + Math.round((f.size * f.progress) / 100),
    0
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* Overall progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-foreground">
            {allComplete ? 'Envoi terminé' : `Envoi en cours... ${overallProgress}%`}
          </p>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                allComplete
                  ? 'bg-emerald-600'
                  : hasErrors
                    ? 'bg-amber-500'
                    : 'bg-primary'
              )}
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedCount}/{files.length} fichiers — {formatFileSize(totalSent)} envoyés
          </p>
        </div>
        {onCancel && !allComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            iconLeft={<X className="size-3.5" />}
          >
            Annuler
          </Button>
        )}
      </div>

      {/* Per-file rows */}
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.id}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-500',
              file.status === 'complete' && 'bg-emerald-500/5',
              file.status === 'error' && 'bg-destructive/5'
            )}
          >
            <span className="shrink-0">{statusIcons[file.status]}</span>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm truncate',
                    file.status === 'error' ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {file.filename}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  {file.status === 'error' && onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(file.id)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                    >
                      <RotateCcw className="size-3" />
                      Réessayer
                    </button>
                  )}
                </div>
              </div>
              {file.status === 'error' && file.error && (
                <p className="text-xs text-destructive">{file.error}</p>
              )}
              {(file.status === 'uploading' || file.status === 'complete') && (
                <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      file.status === 'complete' ? 'bg-emerald-600' : 'bg-primary'
                    )}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
