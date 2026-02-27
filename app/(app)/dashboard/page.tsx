'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Loader2,
  FolderOpen,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  Clock,
  AlertCircle,
  LayoutDashboard,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import { KPICard } from '@/components/dashboard/KPICard'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { MissionRow } from '@/components/dashboard/MissionRow'
import type { DashboardData, DashboardKPIs } from '@/types/dashboard'

// Chart palette derived from Sof'IA brand: dark navy, sky blue, teal accent
const PRIORITY_COLORS: Record<string, string> = {
  Haute: '#172a3a',    // dark navy (logo outline) — urgent
  Moyenne: '#4a9fd4',  // sky blue (logo triangle) — medium
  Basse: '#b5dff5',    // pale blue — low concern
}

const DECISION_COLORS: Record<string, string> = {
  'Validé': '#4ecdc4',      // teal (logo accent dot) — confirmed
  'Rejeté': '#172a3a',      // dark navy — decisive
  'À approfondir': '#6cb4e8', // sky blue (logo triangle) — needs attention
  'En attente': '#c5d8e8',   // pale steel blue — neutral/waiting
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
        <div
          className="absolute inset-y-0 left-0 rounded-md transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setData(json.data)
        }
      }
    } catch {
      // Fail silently
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Read project selection from URL search params (set by breadcrumb)
  const projectParam = searchParams.get('project')
  const selectedProjectId = projectParam || (data?.projects.length ? data.projects[0].id : null)

  const isGlobal = selectedProjectId === 'global'

  // Filter data based on selection
  const filtered = useMemo(() => {
    if (!data) return null

    if (isGlobal) {
      return {
        missions: data.missions,
        signals: data.signals,
        deliverables: data.deliverables,
        kpis: data.kpis,
      }
    }

    const projectMissions = data.missions.filter((m) => m.project_id === selectedProjectId)
    const missionIds = new Set(projectMissions.map((m) => m.id))
    const projectSignals = data.signals.filter((s) => missionIds.has(s.mission_id))
    const projectDeliverables = data.deliverables.filter((d) => missionIds.has(d.mission_id))

    const completedStatuses = ['analyzed', 'in_review', 'completed']

    const kpis: DashboardKPIs = {
      total_projects: 1,
      total_missions: projectMissions.length,
      missions_completed: projectMissions.filter((m) => completedStatuses.includes(m.status)).length,
      missions_in_progress: projectMissions.filter((m) => m.status === 'analyzing').length,
      document_completeness_pct: 0,
      deliverables_generated: projectDeliverables.length,
      total_signals: projectSignals.length,
      pending_decisions: projectSignals.filter((s) => s.human_decision === 'pending').length,
      high_priority_signals: projectSignals.filter((s) => s.priority === 'high').length,
      validated_signals: projectSignals.filter((s) => s.human_decision === 'validated').length,
      rejected_signals: projectSignals.filter((s) => s.human_decision === 'rejected').length,
      to_investigate_signals: projectSignals.filter((s) => s.human_decision === 'to_investigate').length,
    }

    return { missions: projectMissions, signals: projectSignals, deliverables: projectDeliverables, kpis }
  }, [data, selectedProjectId, isGlobal])

  // Chart data from filtered KPIs
  const priorityChartData = useMemo(() => {
    if (!filtered) return []
    const lowCount = filtered.signals.filter((s) => s.priority === 'low').length
    return [
      { name: 'Haute', value: filtered.kpis.high_priority_signals },
      { name: 'Moyenne', value: filtered.kpis.total_signals - filtered.kpis.high_priority_signals - lowCount },
      { name: 'Basse', value: lowCount },
    ].filter((d) => d.value > 0)
  }, [filtered])

  const decisionChartData = useMemo(() => {
    if (!filtered) return []
    const { kpis } = filtered
    return [
      { name: 'Validé', value: kpis.validated_signals },
      { name: 'Rejeté', value: kpis.rejected_signals },
      { name: 'À approfondir', value: kpis.to_investigate_signals },
      { name: 'En attente', value: kpis.pending_decisions },
    ].filter((d) => d.value > 0)
  }, [filtered])

  // Per-project groups (for global view)
  const projectGroups = useMemo(() => {
    if (!data) return []
    return data.projects.map((project) => {
      const projectMissions = data.missions.filter((m) => m.project_id === project.id)
      const missionIds = new Set(projectMissions.map((m) => m.id))
      const projectSignals = data.signals.filter((s) => missionIds.has(s.mission_id))
      return { project, missions: projectMissions, signals: projectSignals }
    })
  }, [data])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="mt-3 text-sm text-muted-foreground">
          Chargement du tableau de bord...
        </span>
      </div>
    )
  }

  // Empty state
  if (!data || data.projects.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center p-5">
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border px-8 py-20">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <LayoutDashboard className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-serif text-lg text-foreground">
            Aucun projet
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Créez votre premier projet client pour voir apparaître votre tableau de bord.
          </p>
          <Link
            href="/projects"
            className={cn(
              'group mt-6 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all',
              'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
              'hover:shadow-md hover:shadow-primary/25 hover:brightness-110'
            )}
          >
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Link>
        </div>
      </div>
    )
  }

  if (!filtered || !selectedProjectId) return null

  const { kpis } = filtered

  return (
    <div className="mx-auto h-full max-w-6xl overflow-y-auto p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isGlobal
            ? 'Vue d\u2019ensemble de tous vos projets'
            : 'Pré-analyse documentaire du projet sélectionné'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          icon={<FolderOpen className="h-5 w-5" />}
          value={kpis.total_projects}
          label={isGlobal ? 'Projets' : 'Projet'}
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={`${kpis.missions_completed}/${kpis.total_missions}`}
          label="Analyses terminées"
          accent={kpis.missions_completed === kpis.total_missions && kpis.total_missions > 0 ? 'success' : 'default'}
        />
        <KPICard
          icon={<FileCheck className="h-5 w-5" />}
          value={kpis.deliverables_generated}
          label="Livrables"
        />
        <KPICard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={kpis.total_signals}
          label="Signaux"
        />
        <KPICard
          icon={<Clock className="h-5 w-5" />}
          value={kpis.pending_decisions}
          label="En attente"
          accent={kpis.pending_decisions > 0 ? 'warning' : 'default'}
        />
        <KPICard
          icon={<AlertCircle className="h-5 w-5" />}
          value={kpis.high_priority_signals}
          label="Haute priorité"
          accent={kpis.high_priority_signals > 0 ? 'destructive' : 'default'}
        />
      </div>

      {/* Charts */}
      {kpis.total_signals > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Signal distribution by priority */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Répartition des signaux</CardTitle>
              <p className="text-xs text-muted-foreground">{kpis.total_signals} {kpis.total_signals !== 1 ? 'signaux' : 'signal'} au total</p>
            </CardHeader>
            <CardBody className="flex flex-col gap-2 pt-0">
              {priorityChartData.map((d) => (
                <BarRow key={d.name} label={d.name} value={d.value} total={kpis.total_signals} color={PRIORITY_COLORS[d.name]} />
              ))}
            </CardBody>
          </Card>

          {/* Decision progress */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Avancement des décisions</CardTitle>
              <p className="text-xs text-muted-foreground">
                {kpis.validated_signals + kpis.rejected_signals + kpis.to_investigate_signals} / {kpis.total_signals} traitée{kpis.total_signals !== 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardBody className="flex flex-col gap-2 pt-0">
              {decisionChartData.map((d) => (
                <BarRow key={d.name} label={d.name} value={d.value} total={kpis.total_signals} color={DECISION_COLORS[d.name]} />
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Content: missions list (client) or project cards (global) */}
      {isGlobal ? (
        /* Global view: per-project cards */
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Projets clients
            </span>
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[10px] font-medium text-muted-foreground/40">
              {data.projects.length}
            </span>
          </div>
          <div className="space-y-2">
            {projectGroups.map(({ project, missions, signals }, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                missions={missions}
                signals={signals}
                index={index}
              />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/projects"
              className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Voir tous les projets
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* Client view: missions list */
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Analyses
            </span>
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[10px] font-medium text-muted-foreground/40">
              {filtered.missions.length}
            </span>
          </div>
          {filtered.missions.length > 0 ? (
            <div className="space-y-2">
              {filtered.missions.map((mission, index) => (
                <MissionRow
                  key={mission.id}
                  mission={mission}
                  signals={filtered.signals}
                  projectId={selectedProjectId}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border py-12">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Aucune analyse pour ce projet
              </p>
              <Link
                href={`/projects/${selectedProjectId}`}
                className="group mt-3 inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
              >
                Ouvrir le projet
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="mt-3 text-sm text-muted-foreground">
            Chargement du tableau de bord...
          </span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
