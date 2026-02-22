'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import SignalCard from '@/components/signals/SignalCard'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Signal, SignalPriority, HumanDecision, SignalType } from '@/types/database'

interface SignalStats {
  total: number
  by_priority: Record<SignalPriority, number>
  by_decision: Record<HumanDecision, number>
}

interface PaginationMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

const priorityFilterOptions = [
  { value: '', label: 'Toutes priorites' },
  { value: 'high', label: 'Elevee' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Faible' },
]

const typeFilterOptions = [
  { value: '', label: 'Tous types' },
  { value: 'absence_piece', label: 'Piece justificative manquante' },
  { value: 'incoherence_date', label: 'Incoherence de dates' },
  { value: 'incoherence_montant', label: 'Ecart de montant' },
  { value: 'rupture_chaine', label: 'Rupture de la chaine documentaire' },
  { value: 'rattachement_temporel', label: 'Doute sur le rattachement temporel' },
  { value: 'incompletude', label: 'Information incomplete' },
]

const decisionFilterOptions = [
  { value: '', label: 'Toutes decisions' },
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Valide' },
  { value: 'rejected', label: 'Rejete' },
  { value: 'to_investigate', label: 'A approfondir' },
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
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [decisionFilter, setDecisionFilter] = useState('')

  const fetchSignals = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: '20' })
      if (priorityFilter) params.set('priority', priorityFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (decisionFilter) params.set('decision', decisionFilter)

      const res = await fetch(`/api/missions/${missionId}/signals?${params}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setSignals(json.data.signals ?? json.data)
          setStats(json.data.stats ?? null)
          setPagination(json.data.pagination ?? null)
        }
      }
    } catch {
      // Silent
    } finally {
      setIsLoading(false)
    }
  }, [missionId, page, priorityFilter, typeFilter, decisionFilter])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <DisclaimerBanner />

      <div className="mt-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-warning-foreground" />
            <div>
              <h2 className="font-serif text-xl text-foreground">Signaux documentaires</h2>
              <p className="text-xs text-muted-foreground">
                {stats ? `${stats.total} signal${stats.total !== 1 ? 'aux' : ''} detecte${stats.total !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-6 flex gap-3">
            <Badge variant={stats.by_decision.pending > 0 ? 'pending' : 'outline'}>
              {stats.by_decision.pending ?? 0} en attente
            </Badge>
            <Badge variant="validated">{stats.by_decision.validated ?? 0} valide(s)</Badge>
            <Badge variant="destructive">{stats.by_decision.rejected ?? 0} rejete(s)</Badge>
            <Badge variant="to-investigate">{stats.by_decision.to_investigate ?? 0} a approfondir</Badge>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {[
            { options: priorityFilterOptions, value: priorityFilter, onChange: setPriorityFilter },
            { options: typeFilterOptions, value: typeFilter, onChange: setTypeFilter },
            { options: decisionFilterOptions, value: decisionFilter, onChange: setDecisionFilter },
          ].map((filter, i) => (
            <select
              key={i}
              value={filter.value}
              onChange={(e) => { filter.onChange(e.target.value); setPage(1) }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}
        </div>

        {/* Signal list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : signals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center">
            <p className="text-sm text-muted-foreground">Aucun signal ne correspond aux filtres.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal, index) => (
              <div
                key={signal.id}
                onClick={() => router.push(`${basePath}/signals/${signal.id}`)}
                className="cursor-pointer"
              >
                <SignalCard signal={signal} index={index} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border p-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} / {pagination.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={page >= pagination.total_pages}
              className="rounded-lg border border-border p-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
