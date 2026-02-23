'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  Bot,
  User,
  Clock,
  Filter,
  ArrowUpDown,
  Loader2,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Trace, ActorType, TraceAction } from '@/types/database'

const actionLabels: Record<TraceAction, string> = {
  mission_created: 'Mission créée',
  mission_updated: 'Mission mise à jour',
  mission_deleted: 'Mission supprimée',
  document_added: 'Document(s) ajouté(s)',
  document_deleted: 'Document supprimé',
  analysis_started: 'Pré-analyse démarrée',
  analysis_completed: 'Pré-analyse terminée',
  analysis_failed: 'Pré-analyse échouée',
  fec_parsed: 'FEC parsé',
  pdf_extracted: 'PDF extraits',
  rapprochement_completed: 'Rapprochement terminé',
  signals_generated: 'Signaux générés',
  deliverables_generated: 'Livrables générés',
  signal_validated: 'Signal validé',
  signal_rejected: 'Signal rejeté',
  signal_to_investigate: 'Signal à approfondir',
  deliverables_regenerated: 'Livrables régénérés',
  deliverables_exported: 'Livrables exportés',
}

export default function ProjectTracesPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { missionId } = use(params)

  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actorFilter, setActorFilter] = useState<'' | ActorType>('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const fetchTraces = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/missions/${missionId}/traces?limit=200`)
      if (!res.ok) throw new Error('Erreur lors du chargement du journal.')

      const json = await res.json()
      setTraces(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur interne.')
    } finally {
      setLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  const filteredTraces = traces
    .filter((t) => !actorFilter || t.actor === actorFilter)
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime()
      const dateB = new Date(b.timestamp).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

  const sofiaCount = traces.filter((t) => t.actor === 'sofia').length
  const userCount = traces.filter((t) => t.actor === 'user').length

  function formatTimestamp(iso: string): string {
    const date = new Date(iso)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-foreground">
          Journal de traçabilité
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique chronologique de toutes les actions (Sof&apos;IA et CAC).
          {traces.length > 0 && ` ${traces.length} action${traces.length !== 1 ? 's' : ''} tracée${traces.length !== 1 ? 's' : ''}.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">{traces.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sof&apos;IA</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-primary">{sofiaCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CAC</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-primary">{userCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filtre :</span>
        <div className="flex rounded-lg border border-border bg-card text-sm">
          <button
            onClick={() => setActorFilter('')}
            className={cn(
              'px-4 py-1.5 transition-colors',
              actorFilter === '' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'
            )}
          >
            Tous
          </button>
          <button
            onClick={() => setActorFilter('sofia')}
            className={cn(
              'border-l border-border px-4 py-1.5 transition-colors',
              actorFilter === 'sofia' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'
            )}
          >
            Sof&apos;IA
          </button>
          <button
            onClick={() => setActorFilter('user')}
            className={cn(
              'border-l border-border px-4 py-1.5 transition-colors',
              actorFilter === 'user' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'
            )}
          >
            CAC
          </button>
        </div>

        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === 'desc' ? 'Plus récent d\'abord' : 'Plus ancien d\'abord'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Timeline */}
      {filteredTraces.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {actorFilter ? 'Aucune action ne correspond au filtre sélectionné.' : 'Aucune action tracée pour cette analyse.'}
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 h-full w-px bg-border" />

          <div className="space-y-0">
            {filteredTraces.map((trace) => {
              const isSofia = trace.actor === 'sofia'

              return (
                <div key={trace.id} className="relative flex gap-4 py-3 pl-0">
                  <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {isSofia ? (
                        <Bot className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-card-foreground">
                          {actionLabels[trace.action] || trace.action}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {trace.actor_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(trace.timestamp)}
                      </div>
                    </div>

                    {trace.details && (
                      <p className="mt-2 text-sm text-muted-foreground">{trace.details}</p>
                    )}

                    {trace.target_type && (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {trace.target_type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="rounded-lg border border-muted bg-muted/50 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Ce journal est généré automatiquement et ne peut être modifié.
          Il constitue la trace des diligences réalisées dans le cadre de cette pré-analyse.
        </p>
      </div>
    </div>
  )
}
