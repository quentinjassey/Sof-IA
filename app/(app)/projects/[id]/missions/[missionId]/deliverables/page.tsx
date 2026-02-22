'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  FileCheck,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import dynamic from 'next/dynamic'

const PdfPreviewModal = dynamic(
  () => import('@/components/ui/PdfPreviewModal').then((m) => m.PdfPreviewModal),
  { ssr: false }
)
import { cn } from '@/lib/utils'
import type { Deliverable, DeliverableType } from '@/types/database'

interface DeliverableMeta {
  title: string
  description: string
  icon: React.ReactNode
  formatLabel: string
}

const deliverableMeta: Record<DeliverableType, DeliverableMeta> = {
  checklist_completude: {
    title: 'Check-list de completude documentaire',
    description: 'Liste des documents attendus, recus et leur statut.',
    icon: <FileCheck className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
  tableau_signaux: {
    title: 'Tableau des signaux documentaires',
    description: 'Tableau detaille de tous les signaux detectes avec les decisions du CAC.',
    icon: <FileSpreadsheet className="h-6 w-6 text-primary" />,
    formatLabel: 'XLSX',
  },
  synthese_preanalyse: {
    title: 'Synthese de pre-analyse (NEP 230)',
    description: 'Document de synthese integrable au dossier de travail.',
    icon: <FileText className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
  journal_tracabilite: {
    title: 'Journal de tracabilite',
    description: 'Historique chronologique de toutes les actions (Sof\'IA et CAC).',
    icon: <ClipboardList className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
}

const deliverableOrder: DeliverableType[] = [
  'checklist_completude',
  'tableau_signaux',
  'synthese_preanalyse',
  'journal_tracabilite',
]

export default function ProjectDeliverablesPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { missionId } = use(params)

  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchDeliverables = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/missions/${missionId}/deliverables`)
      if (res.ok) {
        const json = await res.json()
        setDeliverables(json.data ?? [])
      }
    } catch {
      // Silent
    } finally {
      setIsLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchDeliverables()
  }, [fetchDeliverables])

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/missions/${missionId}/deliverables`, { method: 'POST' })
      if (res.ok) {
        await fetchDeliverables()
      } else {
        const json = await res.json()
        setError(json.error || 'Erreur lors de la regeneration.')
      }
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleDownload = (deliverable: Deliverable) => {
    window.open(`/api/missions/${missionId}/deliverables/${deliverable.id}/download`, '_blank')
  }

  const handlePreview = (deliverable: Deliverable) => {
    if (deliverable.format === 'pdf') {
      setPreviewUrl(`/api/missions/${missionId}/deliverables/${deliverable.id}/preview`)
      setPreviewTitle(deliverableMeta[deliverable.type]?.title ?? deliverable.title)
    }
  }

  const orderedDeliverables = deliverableOrder.map((type) =>
    deliverables.find((d) => d.type === type)
  )

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <DisclaimerBanner />

      <div className="mt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-foreground">Livrables</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Documents generes par la pre-analyse, integrables au dossier de travail
            </p>
          </div>
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            variant="outline"
            size="sm"
          >
            {isRegenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Regenerer
          </Button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {orderedDeliverables.map((deliverable, i) => {
              const type = deliverableOrder[i]
              const meta = deliverableMeta[type]

              return (
                <div
                  key={type}
                  className={cn(
                    'flex items-start gap-4 rounded-xl border bg-card p-5 transition-all',
                    deliverable ? 'border-border' : 'border-dashed border-border/50 opacity-60'
                  )}
                >
                  <div className="shrink-0">{meta.icon}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-card-foreground">{meta.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                    {deliverable && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{meta.formatLabel}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Genere le {new Date(deliverable.generated_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>
                  {deliverable && (
                    <div className="flex shrink-0 items-center gap-2">
                      {deliverable.format === 'pdf' && (
                        <Button
                          onClick={() => handlePreview(deliverable)}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDownload(deliverable)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Telecharger
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {previewUrl && (
        <PdfPreviewModal
          isOpen={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
          title={previewTitle}
          pdfUrl={previewUrl}
        />
      )}
    </div>
  )
}
