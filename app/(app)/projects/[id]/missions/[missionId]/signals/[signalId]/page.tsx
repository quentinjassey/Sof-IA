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
  BookCheck,
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
  absence_piece: 'Pièce justificative manquante',
  incoherence_date: 'Incohérence de dates',
  incoherence_montant: 'Écart de montant',
  rupture_chaine: 'Rupture de la chaîne documentaire',
  rattachement_temporel: 'Doute sur le rattachement temporel',
  incompletude: 'Information incomplète',
}

const priorityVariantMap: Record<SignalPriority, 'priority-high' | 'priority-medium' | 'priority-low'> = {
  high: 'priority-high',
  medium: 'priority-medium',
  low: 'priority-low',
}

const priorityLabels: Record<SignalPriority, string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
}

interface SignalDetail extends Signal {
  related_ecriture: Ecriture | null
  related_document: { id: string; filename: string; type: string; storage_path: string } | null
  related_rapprochement: { id: string; match_type: string; match_details: Record<string, unknown> | null } | null
}

interface SignalNeighbors {
  previous: string | null
  next: string | null
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
  const [neighbors, setNeighbors] = useState<SignalNeighbors>({ previous: null, next: null })
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
          throw new Error(data.error || 'Signal non trouvé.')
        }

        const json = await res.json()
        setSignal(json.data)

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
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm text-destructive">{error || 'Signal non trouvé.'}</p>
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
    <div className={cn('mx-auto max-w-5xl space-y-6 animate-fade-in')}>
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
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={priorityVariantMap[signal.priority]}>
              Priorité {priorityLabels[signal.priority]}
            </Badge>
            {signal.confidence_score != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  signal.confidence_score >= 90
                    ? 'bg-primary/10 text-primary'
                    : signal.confidence_score >= 75
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Confiance {signal.confidence_score} %
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {signalTypeLabels[signal.type]}
            </span>
          </div>
        </div>
      </div>

      <DisclaimerBanner />

      <div className="rounded-2xl border border-border bg-card px-5 py-4">
        <p className="text-sm leading-relaxed text-card-foreground">{signal.description}</p>
      </div>

      {/* Cutoff FEC status indicator */}
      {signal.rule_triggered?.startsWith('CUT-') && (
        <CutoffFecStatusBlock rule={signal.rule_triggered} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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

          {signal.explicability?.documents_compared && signal.explicability.documents_compared.length > 0 && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Documents comparés</h2>
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

          {(signal.rule_triggered || signal.rule_description) && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <Scale className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Règle déclenchée</h2>
              </div>
              <div className="px-5 py-4">
                {signal.rule_triggered && (
                  <p className="text-sm font-medium text-foreground">{signal.rule_triggered}</p>
                )}
                {signal.rule_description && (
                  <p className="mt-1 text-sm text-muted-foreground">{signal.rule_description}</p>
                )}
                {signal.explicability?.rule_source && (
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Référence : {signal.explicability.rule_source}
                  </p>
                )}
              </div>
            </div>
          )}

          {signal.confidence_score != null && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Score de confiance</h2>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold',
                      signal.confidence_score >= 90
                        ? 'bg-primary/10 text-primary'
                        : signal.confidence_score >= 75
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {signal.confidence_score}%
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      {signal.confidence_score >= 90 ? 'Confiance élevée' : signal.confidence_score >= 75 ? 'Confiance bonne' : 'Confiance modérée'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {signal.confidence_explanation || 'Ce score reflète la fiabilité de la détection automatique.'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      signal.confidence_score >= 90 ? 'bg-primary' : signal.confidence_score >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                    )}
                    style={{ width: `${signal.confidence_score}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Ce score reflète la fiabilité de la détection par Sof&apos;IA, pas la gravité du constat.
                  Le commissaire aux comptes reste seul juge de l&apos;importance du signal.
                </p>
              </div>
            </div>
          )}

          {ecriture && (
            <div className="rounded-2xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Écriture FEC associée</h2>
              </div>
              <div className="overflow-x-auto px-5 py-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Numéro</th>
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Compte</th>
                      <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Débit</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-foreground">{ecriture.ecriture_num || '--'}</td>
                      <td className="py-2 pr-4 text-card-foreground">
                        {ecriture.ecriture_date ? new Date(ecriture.ecriture_date).toLocaleDateString('fr-FR') : '--'}
                      </td>
                      <td className="py-2 pr-4 text-card-foreground">
                        {ecriture.compte_num} {ecriture.compte_lib ? `— ${ecriture.compte_lib}` : ''}
                      </td>
                      <td className="py-2 pr-4 text-right text-card-foreground">
                        {ecriture.debit > 0 ? `${ecriture.debit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR` : '--'}
                      </td>
                      <td className="py-2 text-right text-card-foreground">
                        {ecriture.credit > 0 ? `${ecriture.credit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR` : '--'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {ecriture.ecriture_lib && (
                  <p className="mt-2 text-xs text-muted-foreground">Libellé : {ecriture.ecriture_lib}</p>
                )}
                {ecriture.piece_ref && (
                  <p className="mt-1 text-xs text-muted-foreground">Référence pièce : {ecriture.piece_ref}</p>
                )}
              </div>
            </div>
          )}
        </div>

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

      {/* Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        {neighbors.previous ? (
          <button
            onClick={() => router.push(`${basePath}/signals/${neighbors.previous}`)}
            className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Signal précédent
          </button>
        ) : <span />}
        {neighbors.next ? (
          <button
            onClick={() => router.push(`${basePath}/signals/${neighbors.next}`)}
            className="flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Signal suivant
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : <span />}
      </div>
    </div>
  )
}

const CUTOFF_FEC_STATUS: Record<string, { title: string; detail: string }> = {
  'CUT-001': {
    title: 'Facture comptabilisee dans le FEC de l\'exercice clos',
    detail: 'Cette facture est enregistree dans les ecritures comptables de l\'exercice N (avant la date de cloture). La livraison etant constatee apres la cloture, le commissaire aux comptes doit verifier si le produit doit etre rattache a l\'exercice N ou differe sur l\'exercice N+1.',
  },
  'CUT-002': {
    title: 'Facture comptabilisee dans le FEC de l\'exercice suivant',
    detail: 'Cette facture est datee apres la cloture de l\'exercice (N+1) mais la livraison a eu lieu avant la cloture (exercice N). Le commissaire aux comptes doit verifier si un produit a recevoir ou une charge constatee d\'avance doit etre enregistre(e) dans l\'exercice N.',
  },
  'CUT-004': {
    title: 'Operation comptabilisee dans le FEC de l\'exercice clos',
    detail: 'Cette operation est enregistree dans le FEC de l\'exercice clos, mais aucun justificatif de date de livraison n\'est disponible. Sans preuve de la date effective de transfert, le commissaire aux comptes ne peut verifier le rattachement temporel de cette operation.',
  },
  'CUT-005': {
    title: 'Vente initiale comptabilisee dans le FEC de l\'exercice clos',
    detail: 'La vente d\'origine est comptabilisee dans l\'exercice N (avant cloture). L\'avoir est emis en debut d\'exercice N+1. Le commissaire aux comptes doit verifier si la vente initiale etait bien acquise a la cloture ou si l\'avoir revele un sujet de rattachement temporel.',
  },
}

function CutoffFecStatusBlock({ rule }: { rule: string }) {
  const status = CUTOFF_FEC_STATUS[rule]
  if (!status) return null

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center gap-2 border-b border-amber-500/20 px-5 py-3">
        <BookCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Statut dans le FEC</h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{status.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-600/80 dark:text-amber-400/80">{status.detail}</p>
      </div>
    </div>
  )
}
