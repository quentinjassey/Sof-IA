'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  ChevronDown,
  Globe,
  BarChart3,
  Scissors,
  FileSearch,
  Check,
  Settings,
  LayoutDashboard,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompanyLogo, extractCompanyFromTitle } from '@/components/missions/CompanyLogo'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import type { ScenarioType, MissionStatus } from '@/types/database'

interface NavProject {
  id: string
  name: string
}

interface NavMission {
  id: string
  name: string
  project_id: string | null
  scenario: ScenarioType
  status: MissionStatus
}

const SCENARIO_ICONS: Record<ScenarioType, React.ReactNode> = {
  sondage_ca: <BarChart3 className="h-3.5 w-3.5" />,
  cutoff: <Scissors className="h-3.5 w-3.5" />,
  pointage: <FileSearch className="h-3.5 w-3.5" />,
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  sondage_ca: 'Sondage CA',
  cutoff: 'Cut-off',
  pointage: 'Pointage',
}

const STATUS_DOT: Record<MissionStatus, string> = {
  created: 'bg-muted-foreground/40',
  documents_ready: 'bg-primary/60',
  uploading: 'bg-primary/60',
  upload_failed: 'bg-destructive/60',
  analyzing: 'bg-primary/60',
  analysis_failed: 'bg-destructive/60',
  analyzed: 'bg-success/60',
  in_review: 'bg-warning/60',
  completed: 'bg-success/60',
}

// ─── Dropdown hook ──────────────────────────────────────────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return { open, setOpen, ref }
}

// ─── Client Dropdown ────────────────────────────────────────────────────────
function ClientDropdown({
  projects,
  selectedId,
  onSelect,
}: {
  projects: NavProject[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const isGlobal = selectedId === 'global'
  const selected = projects.find((p) => p.id === selectedId)

  const displayName = isGlobal
    ? 'Vue globale'
    : selected
    ? extractCompanyFromTitle(selected.name)
    : 'Client'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-all',
          'hover:bg-accent/70',
          open && 'bg-accent/70'
        )}
      >
        {isGlobal ? (
          <Globe className="h-4 w-4 text-primary" />
        ) : selected ? (
          <CompanyLogo name={extractCompanyFromTitle(selected.name)} className="h-6 w-6 rounded-md" />
        ) : (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground whitespace-nowrap">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-muted-foreground/60 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 animate-fade-in rounded-xl border border-border bg-popover shadow-lg shadow-foreground/5">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {/* Global option */}
            <button
              onClick={() => {
                onSelect('global')
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                isGlobal ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-muted'
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Vue globale</p>
                <p className="text-[11px] text-muted-foreground">Tous les projets</p>
              </div>
              {isGlobal && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>

            <div className="mx-3 my-1 h-px bg-border/60" />

            {projects.map((project) => {
              const isActive = project.id === selectedId
              const companyName = extractCompanyFromTitle(project.name)
              return (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelect(project.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-primary/5 text-primary' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <CompanyLogo name={companyName} className="h-7 w-7" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {project.name}
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mission Dropdown ───────────────────────────────────────────────────────
function MissionDropdown({
  missions,
  selectedId,
  onSelect,
}: {
  missions: NavMission[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const selected = missions.find((m) => m.id === selectedId)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-all',
          'hover:bg-accent/70',
          open && 'bg-accent/70'
        )}
      >
        {selected ? (
          <>
            <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
              {SCENARIO_ICONS[selected.scenario]}
            </span>
            <span className="font-medium text-foreground whitespace-nowrap">
              {selected.name}
            </span>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[selected.status])} />
          </>
        ) : (
          <span className="font-medium text-muted-foreground">Mission</span>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 text-muted-foreground/60 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 animate-fade-in rounded-xl border border-border bg-popover shadow-lg shadow-foreground/5">
          <div className="border-b border-border/60 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Missions ({missions.length})
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {missions.map((mission) => {
              const isActive = mission.id === selectedId
              return (
                <button
                  key={mission.id}
                  onClick={() => {
                    onSelect(mission.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-primary/[0.06]' : 'hover:bg-accent/50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {SCENARIO_ICONS[mission.scenario]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'truncate text-sm font-medium',
                          isActive ? 'text-primary' : 'text-popover-foreground'
                        )}
                      >
                        {mission.name}
                      </span>
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[mission.status])} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {SCENARIO_LABELS[mission.scenario]}
                    </span>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AppBreadcrumb ─────────────────────────────────────────────────────
export default function AppBreadcrumb() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [projects, setProjects] = useState<NavProject[]>([])
  const [missions, setMissions] = useState<NavMission[]>([])

  useEffect(() => {
    async function fetchNav() {
      try {
        const res = await fetch('/api/navigation')
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setProjects(json.data.projects || [])
            setMissions(json.data.missions || [])
          }
        }
      } catch {
        // Fail silently
      }
    }
    fetchNav()
  }, [])

  // ── Parse pathname context ──

  // Dashboard: /dashboard
  const isDashboard = pathname === '/dashboard'

  // Settings: /settings
  const isSettings = pathname.startsWith('/settings')

  // Project page: /projects/[id]
  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/)
  const projectPageId = projectMatch ? projectMatch[1] : null

  // Project > Mission: /projects/[pid]/missions/[mid]/*
  const projectMissionMatch = pathname.match(
    /^\/projects\/([^/]+)\/missions\/([^/]+)(?:\/([^/]+))?/
  )
  const pmProjectId = projectMissionMatch ? projectMissionMatch[1] : null
  const pmMissionId = projectMissionMatch ? projectMissionMatch[2] : null
  const pmSubPage = projectMissionMatch?.[3] || null

  // Legacy mission: /missions/[id]/*
  const legacyMissionMatch = pathname.match(/^\/missions\/([^/]+)(?:\/([^/]+))?/)
  const legacyMissionId = legacyMissionMatch ? legacyMissionMatch[1] : null
  const legacySubPage = legacyMissionMatch?.[2] || null

  // Helpers
  const currentProjectId = pmProjectId || projectPageId
  const currentProject = projects.find((p) => p.id === currentProjectId)
  const currentMissionId = pmMissionId || legacyMissionId
  const currentMission = missions.find((m) => m.id === currentMissionId)
  const currentSubPage = pmSubPage || legacySubPage

  // Missions for the current project (or all if legacy)
  const projectMissions = currentProjectId
    ? missions.filter((m) => m.project_id === currentProjectId)
    : missions

  // Dashboard selected project from searchParams
  const dashboardProjectParam = searchParams.get('project')
  const dashboardSelectedId = dashboardProjectParam || (projects.length > 0 ? projects[0].id : null)

  // ── Navigation handlers ──

  function handleClientSelectOnDashboard(id: string) {
    if (id === 'global') {
      router.push('/dashboard?project=global')
    } else {
      router.push(`/dashboard?project=${id}`)
    }
  }

  function handleClientSelectOnProject(id: string) {
    if (id === 'global') {
      router.push('/dashboard?project=global')
    } else {
      router.push(`/projects/${id}`)
    }
  }

  function handleClientSelectOnMission(id: string) {
    if (id === 'global') {
      router.push('/dashboard?project=global')
    } else {
      router.push(`/projects/${id}`)
    }
  }

  function handleMissionSelect(missionId: string) {
    const mission = missions.find((m) => m.id === missionId)
    if (!mission) return

    const pid = mission.project_id || currentProjectId
    const subPage = currentSubPage || 'analysis'

    if (pid) {
      router.push(`/projects/${pid}/missions/${missionId}/${subPage}`)
    } else {
      // Legacy path
      router.push(`/missions/${missionId}/${subPage}`)
    }
  }

  // ── Render ──

  // Settings page
  if (isSettings) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <BreadcrumbPage>Paramètres</BreadcrumbPage>
            </div>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Dashboard page
  if (isDashboard) {
    const dashMissions = dashboardSelectedId && dashboardSelectedId !== 'global'
      ? missions.filter((m) => m.project_id === dashboardSelectedId)
      : missions
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tableau de bord</span>
            </div>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <ClientDropdown
              projects={projects}
              selectedId={dashboardSelectedId}
              onSelect={handleClientSelectOnDashboard}
            />
          </BreadcrumbItem>
          {dashMissions.length > 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <MissionDropdown
                  missions={dashMissions}
                  selectedId={null}
                  onSelect={handleMissionSelect}
                />
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Project page (no mission)
  if (projectPageId && !pmMissionId) {
    const projMissions = missions.filter((m) => m.project_id === projectPageId)
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <ClientDropdown
              projects={projects}
              selectedId={projectPageId}
              onSelect={handleClientSelectOnProject}
            />
          </BreadcrumbItem>
          {projMissions.length > 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <MissionDropdown
                  missions={projMissions}
                  selectedId={null}
                  onSelect={handleMissionSelect}
                />
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Project > Mission > SubPage
  if (pmProjectId && pmMissionId) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <ClientDropdown
              projects={projects}
              selectedId={pmProjectId}
              onSelect={handleClientSelectOnMission}
            />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <MissionDropdown
              missions={projectMissions}
              selectedId={pmMissionId}
              onSelect={handleMissionSelect}
            />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Legacy mission route: /missions/[id]/*
  if (legacyMissionId) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <MissionDropdown
              missions={missions}
              selectedId={legacyMissionId}
              onSelect={handleMissionSelect}
            />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Projects list page
  if (pathname === '/projects') {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <BreadcrumbPage>Projets</BreadcrumbPage>
            </div>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  // Fallback: empty
  return null
}
