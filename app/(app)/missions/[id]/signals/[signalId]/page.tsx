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

// --- Label maps ---

const signalTypeLabels: Record<SignalType, string> = {
  absence_piece: 'Piece justificative manquante',
  incoherence_date: 'Incoherence de dates',
  incoherence_montant: 'Ecart de montant',
  rupture_chaine: 'Rupture de la chaine documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplete',
}

const priorityVariantMap: Record<SignalPriority, 'priority-high' | 'priority-medium' | 'priority-low'> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

const priorityLabels: Record<SignalPriority, string> = {
  high: 'Elevee',
  medium: 'Moyenne',
  low: 'Faible',
}

// --- Types ---

interface SignalDetail extends Signal {
  related_ecriture: Ecriture | null
  related_document: { id: string; filename: string; type: string; storage_path: string } | null
  related_rapprochement: { id: string; match_type: string; match_details: Record<string, unknown> | null } | null
}

interface SignalNeighbors {
  previous: string | null
  next: string | null
}

// --- Component ---

export default function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string; signalId: string }>
}) {
  const { id: missionId, signalId } = use(params)
  const router = useRouter()

  const [signal, setSignal] = useState<SignalDetail | null>(null)
  const [neighbors, setNeighbors] = useState<SignalNeighbors>({ previous: null, next: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Fetch signal detail ---

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

        // Fetch signal list to determine neighbors
        const listRes = await fetch(`/api/missions/${missionId}/signals?per_page=100&sort=-priority`)
        if (listRes.ok) {
          const listJson = await listRes.json()
          const allSignals = listJson.data || []
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

  // --- Decision callback ---

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

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !signal) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm text-destructive">{error || 'Signal non trouve.'}</p>
          <Link
            href={`/missions/${missionId}/signals`}
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
    <div className={cn('mx-auto max-w-5xl space-y-6 animate-fade-in')}>
      {/* Back link */}
      <Link
        href={`/missions/${missionId}/signals`}
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
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={priorityVariantMap[signal.priority]}>
              Priorite {priorityLabels[signal.priority]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {signalTypeLabels[signal.type]}
            </span>
          </div>
        </div>
      </div>

      <DisclaimerBanner />

      {/* Main description */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-sm leading-relaxed text-card-foreground">{signal.description}</p>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: explicability sections */}
        <div className="space-y-6 lg:col-span-2">
          {/* Constat factuel (reasoning) */}
          {signal.explicability?.reasoning && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Constat factuel</h2>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm leading-relaxed text-card-foreground">
                  {signal.explicability.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Documents compares */}
          {signal.explicability?.documents_compared && signal.explicability.documents_compared.length > 0 && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Documents compares</h2>
              </div>
              <div className="divide-y divide-border/50 px-5 py-2">
                {signal.explicability.documents_compared.map((doc, i) => (
                  <div key={i} className="py-2">
                    <p className="text-sm font-medium text-card-foreground">{doc.document}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{doc.element}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extrait source */}
          {signal.source_extract && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <Quote className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Extrait source</h2>
              </div>
              <div className="px-5 py-4">
                <blockquote className="border-l-4 border-primary/30 bg-primary/5 py-2 pl-4 pr-3">
                  <p className="text-sm italic text-card-foreground">
                    &laquo; {signal.source_extract} &raquo;
                  </p>
                </blockquote>
                <p className="mt-2 text-xs text-muted-foreground">
                  {signal.source_document && `Source : ${signal.source_document}`}
                  {signal.source_page && ` — Page ${signal.source_page}`}
                </p>
              </div>
            </div>
          )}

          {/* Regle declenchee */}
          {(signal.rule_triggered || signal.rule_description) && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <Scale className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Regle declenchee</h2>
              </div>
              <div className="px-5 py-4">
                {signal.rule_triggered && (
                  <p className="text-sm font-medium text-foreground">
                    {signal.rule_triggered}
                  </p>
                )}
                {signal.rule_description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {signal.rule_description}
                  </p>
                )}
                {signal.explicability?.rule_source && (
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Reference : {signal.explicability.rule_source}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Ecriture FEC associee */}
          {ecriture && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Ecriture FEC associee</h2>
              </div>
              <div className="overflow-x-auto px-5 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Numero</th>
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Compte</th>
                      <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Debit</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        {ecriture.ecriture_num || '--'}
                      </td>
                      <td className="py-2 pr-4 text-card-foreground">
                        {ecriture.ecriture_date
                          ? new Date(ecriture.ecriture_date).toLocaleDateString('fr-FR')
                          : '--'}
                      </td>
                      <td className="py-2 pr-4 text-card-foreground">
                        {ecriture.compte_num} {ecriture.compte_lib ? `— ${ecriture.compte_lib}` : ''}
                      </td>
                      <td className="py-2 pr-4 text-right text-card-foreground">
                        {ecriture.debit > 0
                          ? `${ecriture.debit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`
                          : '--'}
                      </td>
                      <td className="py-2 text-right text-card-foreground">
                        {ecriture.credit > 0
                          ? `${ecriture.credit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`
                          : '--'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {ecriture.ecriture_lib && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Libelle : {ecriture.ecriture_lib}
                  </p>
                )}
                {ecriture.piece_ref && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reference piece : {ecriture.piece_ref}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Decision panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <DecisionPanel
              signalId={signal.id}
              missionId={missionId}
              currentDecision={signal.human_decision}
              currentComment={signal.human_comment}
              decidedAt={signal.decided_at}
              onDecisionSaved={handleDecisionSaved}
            />
          </div>
        </div>
      </div>

      {/* Navigation: Previous / Next */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        {neighbors.previous ? (
          <button
            onClick={() => router.push(`/missions/${missionId}/signals/${neighbors.previous}`)}
            className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Signal precedent
          </button>
        ) : (
          <span />
        )}
        {neighbors.next ? (
          <button
            onClick={() => router.push(`/missions/${missionId}/signals/${neighbors.next}`)}
            className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Signal suivant
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
