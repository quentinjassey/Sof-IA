'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  Bot,
  User,
  Clock,
  Filter,
  Loader2,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Trace, ActorType, TraceAction } from '@/types/database'

const actionLabels: Record<TraceAction, string> = {
  mission_created: 'Mission creee',
  mission_updated: 'Mission mise a jour',
  mission_deleted: 'Mission supprimee',
  document_added: 'Document(s) ajoute(s)',
  document_deleted: 'Document supprime',
  analysis_started: 'Pre-analyse demarree',
  analysis_completed: 'Pre-analyse terminee',
  analysis_failed: 'Pre-analyse echouee',
  fec_parsed: 'FEC parse',
  pdf_extracted: 'PDF extraits',
  rapprochement_completed: 'Rapprochement termine',
  signals_generated: 'Signaux generes',
  deliverables_generated: 'Livrables generes',
  signal_validated: 'Signal valide',
  signal_rejected: 'Signal rejete',
  signal_to_investigate: 'Signal a approfondir',
  deliverables_regenerated: 'Livrables regeneres',
  deliverables_exported: 'Livrables exportes',
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ProjectTracesPage({
  params,
}: {
  params: Promise<{ id: string; missionId: string }>
}) {
  const { missionId } = use(params)

  const [traces, setTraces] = useState<Trace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actorFilter, setActorFilter] = useState<'' | ActorType>('')

  const fetchTraces = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/missions/${missionId}/traces`)
      if (res.ok) {
        const json = await res.json()
        setTraces(json.data ?? [])
      }
    } catch {
      // Silent
    } finally {
      setIsLoading(false)
    }
  }, [missionId])

  useEffect(() => {
    fetchTraces()
  }, [fetchTraces])

  const filteredTraces = actorFilter
    ? traces.filter((t) => t.actor === actorFilter)
    : traces

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-serif text-xl text-foreground">Journal de tracabilite</h2>
            <p className="text-xs text-muted-foreground">
              Historique chronologique immutable de toutes les actions (NEP 230)
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value as '' | ActorType)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">Tous les acteurs</option>
          <option value="sofia">Sof&apos;IA</option>
          <option value="user">CAC</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredTraces.length} entree{filteredTraces.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredTraces.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Aucune entree dans le journal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTraces.map((trace) => (
            <div
              key={trace.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                trace.actor === 'sofia' ? 'bg-primary/10' : 'bg-muted'
              )}>
                {trace.actor === 'sofia' ? (
                  <Bot className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {actionLabels[trace.action] || trace.action}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{trace.actor_name}</p>
                {trace.details && (
                  <p className="mt-1 text-xs text-foreground/80">{trace.details}</p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimestamp(trace.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
