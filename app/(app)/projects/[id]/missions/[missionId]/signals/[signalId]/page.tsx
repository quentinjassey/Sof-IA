'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  BookOpen,
  Quote,
  Scale,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import DecisionPanel from '@/components/signals/DecisionPanel'
import { Badge } from '@/components/ui/Badge'
import type {
  Signal,
  Ecriture,
  SignalType,
  SignalPriority,
  HumanDecision,
} from '@/types/database'

const signalTypeLabels: Record<SignalType, string> = {
  absence_piece: 'Piece justificative manquante',
  incoherence_date: 'Incoherence de dates',
  incoherence_montant: 'Ecart de montant',
  rupture_chaine: 'Rupture de la chaine documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplete',
}

const priorityLabels: Record<SignalPriority, string> = {
  high: 'Elevee',
  medium: 'Moyenne',
  low: 'Faible',
}

const priorityVariant: Record<SignalPriority, 'priority-high' | 'priority-medium' | 'priority-low'> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

interface SignalDetail extends Signal {
  related_ecriture?: Ecriture | null
}

export default function ProjectSignalDetailPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string; signalId: string }>
}) {
  const { id: projectId, missionId, signalId } = use(params)
  const router = useRouter()
  const basePath = `/projects/${projectId}/missions/${missionId}`

  const [signal, setSignal] = useState<SignalDetail | null>(null)
  const [neighbors, setNeighbors] = useState<{ previous: string | null; next: string | null }>({
    previous: null,
    next: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSignal() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/missions/${missionId}/signals/${signalId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Signal non trouve.')
        }
        const json = await res.json()
        setSignal(json.data)

        const listRes = await fetch(`/api/missions/${missionId}/signals?per_page=100&sort=-priority`)
        if (listRes.ok) {
          const listJson = await listRes.json()
          const allSignals = listJson.data?.signals ?? listJson.data ?? []
          const currentIndex = allSignals.findIndex((s: Signal) => s.id === signalId)
          setNeighbors({
            previous: currentIndex > 0 ? allSignals[currentIndex - 1].id : null,
            next: currentIndex < allSignals.length - 1 ? allSignals[currentIndex + 1].id : null,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur interne.')
      } finally {
        setLoading(false)
      }
    }
    fetchSignal()
  }, [missionId, signalId])

  function handleDecisionSaved(decision: HumanDecision, comment: string) {
    if (signal) {
      setSignal({
        ...signal,
        human_decision: decision,
        human_comment: comment || null,
        decided_at: new Date().toISOString(),
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !signal) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm text-destructive">{error || 'Signal non trouve.'}</p>
          <Link
            href={`${basePath}/signals`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux signaux
          </Link>
        </div>
      </div>
    )
  }

  const ecriture = signal.related_ecriture

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8 space-y-6 animate-fade-in">
      <Link
        href={`${basePath}/signals`}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux signaux
      </Link>

      {/* Signal header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Signal {signal.rule_triggered || signalTypeLabels[signal.type]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {signalTypeLabels[signal.type]}
          </p>
        </div>
        <Badge variant={priorityVariant[signal.priority]}>
          Priorite {priorityLabels[signal.priority]}
        </Badge>
      </div>

      <DisclaimerBanner />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Constat factuel
            </h3>
            <p className="text-sm leading-relaxed text-foreground">{signal.description}</p>
          </div>

          {/* Explicability */}
          {signal.explicability && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Explicabilite
              </h3>
              <p className="mb-3 text-sm leading-relaxed text-foreground">
                {signal.explicability.reasoning}
              </p>
              {signal.explicability.documents_compared?.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Documents compares :</p>
                  <ul className="space-y-1">
                    {signal.explicability.documents_compared.map((dc, i) => (
                      <li key={i} className="text-xs text-foreground">
                        <span className="font-medium">{dc.document}</span> — {dc.element}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Regle :</span> {signal.explicability.rule_source}
              </p>
            </div>
          )}

          {/* Source extract */}
          {signal.source_extract && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <Quote className="h-4 w-4 text-primary" />
                Extrait source
              </h3>
              <blockquote className="rounded-lg border-l-4 border-primary/30 bg-muted/30 py-3 pl-4 pr-3 text-sm italic text-foreground">
                {signal.source_extract}
              </blockquote>
              {signal.source_document && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Document : {signal.source_document}
                  {signal.source_page ? ` — Page ${signal.source_page}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Confidence */}
          {signal.confidence_score !== null && signal.confidence_score !== undefined && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Score de confiance
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${signal.confidence_score}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">{signal.confidence_score}%</span>
              </div>
              {signal.confidence_explanation && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {signal.confidence_explanation}
                </p>
              )}
            </div>
          )}

          {/* Related ecriture */}
          {ecriture && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-card-foreground">
                <Scale className="h-4 w-4 text-primary" />
                Ecriture comptable associee
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><span className="text-muted-foreground">Date :</span> <span className="text-foreground">{ecriture.ecriture_date}</span></div>
                <div><span className="text-muted-foreground">Journal :</span> <span className="text-foreground">{ecriture.journal_code} — {ecriture.journal_lib}</span></div>
                <div><span className="text-muted-foreground">Compte :</span> <span className="text-foreground">{ecriture.compte_num} — {ecriture.compte_lib}</span></div>
                <div><span className="text-muted-foreground">Reference :</span> <span className="text-foreground">{ecriture.piece_ref}</span></div>
                <div><span className="text-muted-foreground">Debit :</span> <span className="text-foreground">{Number(ecriture.debit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</span></div>
                <div><span className="text-muted-foreground">Credit :</span> <span className="text-foreground">{Number(ecriture.credit).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Libelle :</span> <span className="text-foreground">{ecriture.ecriture_lib}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Decision panel */}
        <div className="space-y-4">
          <DecisionPanel
            missionId={missionId}
            signalId={signalId}
            currentDecision={signal.human_decision}
            currentComment={signal.human_comment}
            decidedAt={signal.decided_at}
            onDecisionSaved={handleDecisionSaved}
          />

          {/* Navigation */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            {neighbors.previous ? (
              <Link href={`${basePath}/signals/${neighbors.previous}`} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                <ArrowLeft className="h-3 w-3" /> Precedent
              </Link>
            ) : <span />}
            {neighbors.next ? (
              <Link href={`${basePath}/signals/${neighbors.next}`} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                Suivant <ArrowRight className="h-3 w-3" />
              </Link>
            ) : <span />}
          </div>
        </div>
      </div>
    </div>
  )
}
