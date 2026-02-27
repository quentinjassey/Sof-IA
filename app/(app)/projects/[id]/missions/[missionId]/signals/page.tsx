'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Info,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import SignalCard from '@/components/signals/SignalCard'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Signal, SignalPriority, HumanDecision } from '@/types/database'

interface CoverageData {
  ca_total: number
  montant_teste_ht: number
  montant_factures_ht: number
  montant_avoirs_ht: number
  couverture_pct: number
  pieces_testees: number
  montant_signaux: number
  taux_erreur_pct: number
  extrapolation_montant: number
}

interface SignalStats {
  total: number
  by_priority: Record<SignalPriority, number>
  by_decision: Record<HumanDecision, number>
  coverage?: CoverageData | null
}

interface PaginationMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

const priorityFilterOptions: { value: string; label: string }[] = [
  { value: '', label: 'Toutes priorités' },
  { value: 'high', label: 'Élevée' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Faible' },
]

const typeFilterOptions: { value: string; label: string }[] = [
  { value: '', label: 'Tous types' },
  { value: 'absence_piece', label: 'Pièce justificative manquante' },
  { value: 'incoherence_date', label: 'Incohérence de dates' },
  { value: 'incoherence_montant', label: 'Écart de montant' },
  { value: 'rupture_chaine', label: 'Rupture de la chaîne documentaire' },
  { value: 'rattachement_temporel', label: 'Doute sur le rattachement temporel' },
  { value: 'incompletude', label: 'Information incomplète' },
]

const decisionFilterOptions: { value: string; label: string }[] = [
  { value: '', label: 'Tous statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Validé' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'to_investigate', label: 'À approfondir' },
]

export default function ProjectSignalsPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { id: projectId, missionId } = use(params)
  const router = useRouter()
  const basePath = `/projects/${projectId}/missions/${missionId}`

  const [signals, setSignals] = useState<Signal[]>([])
  const [stats, setStats] = useState<SignalStats | null>(null)
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      if (priorityFilter) queryParams.set('priority', priorityFilter)
      if (typeFilter) queryParams.set('type', typeFilter)
      if (decisionFilter) queryParams.set('decision', decisionFilter)
      queryParams.set('page', String(page))
      queryParams.set('per_page', '20')
      queryParams.set('sort', '-priority')

      const res = await fetch(`/api/missions/${missionId}/signals?${queryParams.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement des signaux.')

      const json = await res.json()
      setSignals(json.data || [])
      setMeta(json.meta || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur interne.')
    } finally {
      setLoading(false)
    }
  }, [missionId, priorityFilter, typeFilter, decisionFilter, page])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${missionId}/signals/stats`)
      if (res.ok) {
        const json = await res.json()
        setStats(json.data || null)
      }
    } catch {
      // Non-critical
    }
  }, [missionId])

  useEffect(() => {
    fetchSignals()
    fetchStats()
  }, [fetchSignals, fetchStats])

  const totalSignals = stats?.total ?? meta?.total ?? signals.length
  const highCount = stats?.by_priority?.high ?? signals.filter((s) => s.priority === 'high').length
  const mediumCount = stats?.by_priority?.medium ?? signals.filter((s) => s.priority === 'medium').length
  const lowCount = stats?.by_priority?.low ?? signals.filter((s) => s.priority === 'low').length
  const pendingCount = stats?.by_decision?.pending ?? signals.filter((s) => s.human_decision === 'pending').length
  const validatedCount = stats?.by_decision?.validated ?? signals.filter((s) => s.human_decision === 'validated').length
  const rejectedCount = stats?.by_decision?.rejected ?? signals.filter((s) => s.human_decision === 'rejected').length
  const investigateCount = stats?.by_decision?.to_investigate ?? signals.filter((s) => s.human_decision === 'to_investigate').length

  return (
    <div className={cn('mx-auto max-w-5xl space-y-6', 'animate-fade-in')}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="font-serif text-2xl tracking-tight text-foreground">
              Signaux documentaires détectés
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalSignals} {totalSignals !== 1 ? 'signaux identifiés' : 'signal identifié'} lors de la pré-analyse
            </p>
          </div>
        </div>
      </div>

      <DisclaimerBanner />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Priorité élevée</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{highCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Priorité moyenne</p>
          <p className="mt-1 text-2xl font-bold text-warning-foreground">{mediumCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En attente</p>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Décidés</p>
          <p className="mt-1 text-2xl font-bold text-success">{validatedCount + rejectedCount + investigateCount}</p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Résumé :</span>
        <Badge variant="priority-high">{highCount} élevée{highCount !== 1 ? 's' : ''}</Badge>
        <Badge variant="priority-medium">{mediumCount} moyenne{mediumCount !== 1 ? 's' : ''}</Badge>
        <Badge variant="priority-low">{lowCount} faible{lowCount !== 1 ? 's' : ''}</Badge>
        <span className="text-border">|</span>
        <Badge variant="pending">{pendingCount} en attente</Badge>
        <Badge variant="validated">{validatedCount} validé{validatedCount !== 1 ? 's' : ''}</Badge>
        <Badge variant="rejected">{rejectedCount} rejeté{rejectedCount !== 1 ? 's' : ''}</Badge>
        <Badge variant="to-investigate">{investigateCount} à approfondir</Badge>
      </div>

      {/* Coverage KPI — sondage_ca only */}
      {stats?.coverage && stats.coverage.ca_total > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03]">
          <div className="flex items-center gap-2 border-b border-primary/10 px-5 py-3">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Couverture du chiffre d&apos;affaires</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">CA total HT (FEC)</p>
              <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                {stats.coverage.ca_total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Montant net testé HT</p>
              <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                {stats.coverage.montant_teste_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </p>
              <p className="text-[10px] text-muted-foreground">
                {stats.coverage.pieces_testees} pièce{stats.coverage.pieces_testees > 1 ? 's' : ''}
                {stats.coverage.montant_avoirs_ht > 0 && (
                  <> (dont {stats.coverage.montant_avoirs_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € d&apos;avoirs)</>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Taux de couverture</p>
              <p className={cn(
                'mt-1 text-lg font-bold tabular-nums',
                stats.coverage.couverture_pct >= 50 ? 'text-success' : 'text-warning-foreground'
              )}>
                {stats.coverage.couverture_pct}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Montant avec signaux</p>
              <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                {stats.coverage.montant_signaux.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Taux d&apos;erreur échantillon</p>
              <p className={cn(
                'mt-1 text-lg font-bold tabular-nums',
                stats.coverage.taux_erreur_pct > 5 ? 'text-destructive' : stats.coverage.taux_erreur_pct > 0 ? 'text-warning-foreground' : 'text-success'
              )}>
                {stats.coverage.taux_erreur_pct}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Extrapolation sur le CA</p>
              <p className={cn(
                'mt-1 text-lg font-bold tabular-nums',
                stats.coverage.extrapolation_montant > 0 ? 'text-destructive' : 'text-success'
              )}>
                {stats.coverage.extrapolation_montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </p>
              <p className="text-[10px] text-muted-foreground">
                projection sur le CA total
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-primary/10 px-5 py-2.5">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
            <p className="text-[10px] text-muted-foreground">
              Projection mathématique à partir de l&apos;échantillon testé. La qualification (significatif ou non) et la comparaison au seuil de signification relèvent du jugement professionnel du commissaire aux comptes.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filtres :</span>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {priorityFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {typeFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={decisionFilter}
          onChange={(e) => { setDecisionFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {decisionFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Signal list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <AlertTriangle className={cn('mx-auto h-10 w-10', 'text-muted-foreground/40')} />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Aucun signal documentaire ne correspond aux filtres sélectionnés.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal, index) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              index={(meta?.page ? (meta.page - 1) * (meta.per_page || 20) : 0) + index + 1}
              onClick={() => router.push(`${basePath}/signals/${signal.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} sur {meta.total_pages} ({meta.total} signaux)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={cn(
                'rounded-md border border-border p-1.5 text-muted-foreground transition-colors',
                'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(meta.total_pages, page + 1))}
              disabled={page >= meta.total_pages}
              className={cn(
                'rounded-md border border-border p-1.5 text-muted-foreground transition-colors',
                'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
