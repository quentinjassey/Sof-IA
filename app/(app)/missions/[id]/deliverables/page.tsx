'use client'

import { useState, useEffect, useCallback, useMemo, use } from 'react'
import {
  FileCheck,
  FileSpreadsheet,
  FileText,
  ClipboardList,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  Info,
  Eye,
  Scale,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import dynamic from 'next/dynamic'

const PdfPreviewModal = dynamic(
  () => import('@/components/ui/PdfPreviewModal').then((m) => m.PdfPreviewModal),
  { ssr: false }
)
import { MissionPageHeader } from '@/components/missions/MissionPageHeader'
import { cn } from '@/lib/utils'
import type { Deliverable, DeliverableType } from '@/types/database'

// --- Deliverable metadata ---

interface DeliverableMeta {
  title: string
  description: string
  icon: React.ReactNode
  formatLabel: string
}

const deliverableMeta: Record<DeliverableType, DeliverableMeta> = {
  checklist_completude: {
    title: 'Check-list de complétude documentaire',
    description: 'Liste des documents attendus, reçus et leur statut. Permet de vérifier la complétude du dossier documentaire.',
    icon: <FileCheck className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
  tableau_signaux: {
    title: 'Tableau des signaux documentaires',
    description: 'Tableau détaillé de tous les signaux détectés avec les décisions du commissaire aux comptes.',
    icon: <FileSpreadsheet className="h-6 w-6 text-primary" />,
    formatLabel: 'XLSX',
  },
  tableau_rapprochement: {
    title: 'Tableau de rapprochement et justification du CA',
    description: 'Détail pièce par pièce des écritures testées, rapprochement factures/BL, et couverture du chiffre d\'affaires.',
    icon: <Scale className="h-6 w-6 text-primary" />,
    formatLabel: 'XLSX',
  },
  synthese_preanalyse: {
    title: 'Synthèse de pré-analyse (NEP 230)',
    description: 'Document de synthèse intégrable au dossier de travail. Périmètre, constats, décisions et limites.',
    icon: <FileText className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
  journal_tracabilite: {
    title: 'Journal de traçabilité',
    description: 'Historique chronologique complet de toutes les actions réalisées (Sof\'IA et CAC).',
    icon: <ClipboardList className="h-6 w-6 text-primary" />,
    formatLabel: 'PDF',
  },
}

const BASE_DELIVERABLE_ORDER: DeliverableType[] = [
  'checklist_completude',
  'tableau_signaux',
  'synthese_preanalyse',
  'journal_tracabilite',
]

// --- Component ---

export default function DeliverablesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: missionId } = use(params)

  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewDeliverable, setPreviewDeliverable] = useState<{ id: string; title: string } | null>(null)

  // --- Fetch deliverables ---

  const fetchDeliverables = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${missionId}/deliverables`)
      if (!res.ok) {
        throw new Error('Erreur lors du chargement des livrables.')
      }
      const json = await res.json()
      setDeliverables(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur interne.')
    } finally {
      setLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchDeliverables()
  }, [fetchDeliverables])

  // --- Regenerate ---

  async function handleRegenerate() {
    setRegenerating(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/missions/${missionId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la régénération.')
      }

      setSuccessMessage('Livrables régénérés avec succès. Vos décisions de validation sont intégrées.')
      await fetchDeliverables()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la régénération.')
    } finally {
      setRegenerating(false)
    }
  }

  // --- Download ---

  function handleDownload(deliverable: Deliverable) {
    window.open(`/api/missions/${missionId}/deliverables/${deliverable.id}/download`, '_blank')
  }

  // --- Get deliverable by type ---

  function getDeliverable(type: DeliverableType): Deliverable | undefined {
    return deliverables.find((d) => d.type === type)
  }

  // Dynamic order: include scenario-specific deliverables only when they exist
  const deliverableOrder = useMemo(() => {
    const order = [...BASE_DELIVERABLE_ORDER]
    if (deliverables.some((d) => d.type === 'tableau_rapprochement')) {
      order.splice(2, 0, 'tableau_rapprochement')
    }
    return order
  }, [deliverables])

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      {/* Page header */}
      <MissionPageHeader
        missionId={missionId}
        title="Livrables générés"
        subtitle="Check-list, tableau des signaux, synthèse de pré-analyse et journal de traçabilité."
      />

      <DisclaimerBanner />

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div>
          <p className="text-sm text-primary">
            Les livrables intègrent vos décisions de validation.
            Cliquez sur &laquo; Régénérer &raquo; pour mettre à jour après de nouvelles décisions.
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-4 py-3">
          <FileCheck className="h-5 w-5 flex-shrink-0 text-success" />
          <p className="text-sm text-success">{successMessage}</p>
        </div>
      )}

      {/* Deliverable cards */}
      <div className="space-y-4">
        {deliverableOrder.map((type) => {
          const meta = deliverableMeta[type]
          const deliverable = getDeliverable(type)
          const isAvailable = !!deliverable

          return (
            <div
              key={type}
              className={cn(
                'rounded-2xl border border-border bg-card transition-shadow',
                isAvailable ? 'hover:shadow-sm' : 'opacity-60'
              )}
            >
              <div className="flex items-start gap-4 px-5 py-4">
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-card-foreground">{meta.title}</h3>
                    <Badge variant="default">{meta.formatLabel}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                  {deliverable && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Généré le {new Date(deliverable.generated_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {isAvailable ? (
                    <>
                      {meta.formatLabel === 'PDF' && (
                        <button
                          onClick={() => setPreviewDeliverable({ id: deliverable!.id, title: meta.title })}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          title="Aperçu"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(deliverable!)}
                        iconLeft={<Download className="h-4 w-4" />}
                      >
                        Télécharger {meta.formatLabel}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Non disponible</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {deliverables.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Aucun livrable généré pour cette mission.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Les livrables seront générés automatiquement à l&apos;issue de la pré-analyse.
          </p>
        </div>
      )}

      {/* Regenerate button */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-card-foreground">
              {deliverables.length === 0 ? 'Générer les livrables' : 'Régénérer les livrables'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {deliverables.length === 0
                ? 'Génère les 4 livrables à partir des résultats de la pré-analyse.'
                : 'Régénère tous les livrables en intégrant vos dernières décisions de validation.'}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={handleRegenerate}
            loading={regenerating}
            disabled={regenerating}
            iconLeft={<RotateCcw className="h-4 w-4" />}
          >
            {deliverables.length === 0 ? 'Générer les livrables' : 'Régénérer tous les livrables'}
          </Button>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="rounded-lg border border-muted bg-muted/50 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Ces documents sont des outils de pré-analyse. Ils ne constituent pas une conclusion d&apos;audit.
        </p>
      </div>

      {/* PDF Preview Modal */}
      {previewDeliverable && (
        <PdfPreviewModal
          isOpen={!!previewDeliverable}
          onClose={() => setPreviewDeliverable(null)}
          title={previewDeliverable.title}
          pdfUrl={`/api/missions/${missionId}/deliverables/${previewDeliverable.id}/preview`}
          downloadUrl={`/api/missions/${missionId}/deliverables/${previewDeliverable.id}/download`}
        />
      )}
    </div>
  )
}
