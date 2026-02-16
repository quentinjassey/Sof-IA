'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  FolderOpen,
  BarChart3,
  Scissors,
  FileSearch,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Clock,
  ChevronRight,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Building2 } from 'lucide-react'
import type { Mission, ScenarioType, MissionStatus } from '@/types/database'

interface ScenarioOption {
  id: ScenarioType
  label: string
  description: string
  icon: React.ReactNode
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: 'sondage_ca',
    label: 'Sondage sur le chiffre d\'affaires',
    description:
      'Rapprochement des factures de vente avec les bons de livraison et les écritures du FEC.',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    id: 'cutoff',
    label: 'Césure d\'exercice (cut-off)',
    description:
      'Vérification du rattachement temporel des opérations autour de la date de clôture.',
    icon: <Scissors className="h-5 w-5" />,
  },
  {
    id: 'pointage',
    label: 'Pointage états financiers / annexe',
    description:
      'Cohérence entre le bilan, le compte de résultat et l\'annexe.',
    icon: <FileSearch className="h-5 w-5" />,
  },
]

const STATUS_CONFIG: Record<MissionStatus, { label: string; className: string }> = {
  created: { label: 'Créée', className: 'bg-muted text-muted-foreground' },
  documents_ready: { label: 'Documents prêts', className: 'bg-primary/10 text-primary' },
  uploading: { label: 'Envoi en cours', className: 'bg-primary/10 text-primary' },
  upload_failed: { label: 'Échec envoi', className: 'bg-destructive/10 text-destructive' },
  analyzing: { label: 'Analyse en cours', className: 'bg-primary/10 text-primary' },
  analysis_failed: { label: 'Échec analyse', className: 'bg-destructive/10 text-destructive' },
  analyzed: { label: 'Analysée', className: 'bg-success/10 text-success' },
  in_review: { label: 'En revue', className: 'bg-warning/10 text-warning-foreground' },
  completed: { label: 'Terminée', className: 'bg-success/10 text-success' },
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  sondage_ca: 'Sondage CA',
  cutoff: 'Cut-off',
  pointage: 'Pointage',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getMissionLink(mission: Mission): string {
  switch (mission.status) {
    case 'created':
    case 'documents_ready':
    case 'upload_failed':
      return `/missions/${mission.id}/documents`
    case 'uploading':
    case 'analyzing':
    case 'analysis_failed':
      return `/missions/${mission.id}/analysis`
    case 'analyzed':
    case 'in_review':
      return `/missions/${mission.id}/signals`
    case 'completed':
      return `/missions/${mission.id}/deliverables`
    default:
      return `/missions/${mission.id}/documents`
  }
}

export default function MissionsPage() {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [missionName, setMissionName] = useState('')
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setMissions(json.data)
        }
      }
    } catch {
      // Fail silently
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const handleCreate = useCallback(async () => {
    if (!missionName.trim() || !selectedScenario) {
      setError('Veuillez renseigner le nom de la mission et sélectionner un scénario.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: missionName.trim(),
          scenario: selectedScenario,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || 'Erreur lors de la création de la mission.')
        return
      }

      router.push(`/missions/${json.data.id}/documents`)
    } catch {
      setError('Impossible de contacter le serveur.')
    } finally {
      setIsCreating(false)
    }
  }, [missionName, selectedScenario, router])

  const resetForm = useCallback(() => {
    setShowCreateForm(false)
    setMissionName('')
    setSelectedScenario(null)
    setError(null)
  }, [])

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-foreground">
            Missions de pré-analyse
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos missions de pré-analyse documentaire
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className={cn(
              "group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
              "hover:shadow-md hover:shadow-primary/25 hover:brightness-110"
            )}
          >
            <Plus className="h-4 w-4" />
            Nouvelle mission
          </button>
        )}
      </div>

      {/* Create mission form */}
      {showCreateForm && (
        <div className="animate-fade-in mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-lg text-card-foreground">
              Nouvelle mission
            </h2>
            <button
              onClick={resetForm}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mission name */}
          <div className="mb-6">
            <label
              htmlFor="mission-name"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Nom de la mission
            </label>
            <input
              id="mission-name"
              type="text"
              value={missionName}
              onChange={(e) => {
                setMissionName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Audit Société XYZ — Exercice 2025"
              className={cn(
                "block w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground",
                "placeholder:text-muted-foreground/50",
                "transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
              autoFocus
            />
          </div>

          {/* Scenario selection */}
          <div className="mb-6">
            <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Scénario de pré-analyse
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {SCENARIOS.map((scenario) => {
                const selected = selectedScenario === scenario.id
                return (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      setSelectedScenario(scenario.id)
                      if (error) setError(null)
                    }}
                    className={cn(
                      "group relative rounded-xl border-2 p-5 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/[0.04] shadow-sm shadow-primary/10"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/30"
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                    )}
                    <div
                      className={cn(
                        "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        selected
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      {scenario.icon}
                    </div>
                    <h3
                      className={cn(
                        "mb-1.5 text-sm font-semibold transition-colors",
                        selected ? "text-primary" : "text-card-foreground"
                      )}
                    >
                      {scenario.label}
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {scenario.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !missionName.trim() || !selectedScenario}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
                "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                "hover:shadow-md hover:shadow-primary/25 hover:brightness-110",
                "disabled:pointer-events-none disabled:opacity-50"
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  Créer la mission
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Missions list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="mt-3 text-sm text-muted-foreground">
            Chargement des missions...
          </span>
        </div>
      ) : missions.length === 0 && !showCreateForm ? (
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-20">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg text-foreground">
            Aucune mission
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez votre première mission de pré-analyse
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className={cn(
              "group mt-6 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
              "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
              "hover:shadow-md hover:shadow-primary/25 hover:brightness-110"
            )}
          >
            <Plus className="h-4 w-4" />
            Nouvelle mission
          </button>
        </div>
      ) : (
        <>
          {missions.length > 0 && (
            <div>
              {!showCreateForm && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                    Missions existantes
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-medium text-muted-foreground/40">
                    {missions.length}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {missions.map((mission, index) => {
                  const status = STATUS_CONFIG[mission.status]
                  return (
                    <button
                      key={mission.id}
                      onClick={() => router.push(getMissionLink(mission))}
                      className={cn(
                        "group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all",
                        "hover:border-primary/20 hover:shadow-sm",
                        "animate-fade-in opacity-0"
                      )}
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="truncate text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
                            {mission.name}
                          </h3>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
                              status.className
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-secondary-foreground">
                            {SCENARIO_LABELS[mission.scenario]}
                          </span>
                          {mission.company_id && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {mission.company_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(mission.created_at)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
