'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronDown,
  FolderOpen,
  BarChart3,
  Scissors,
  FileSearch,
  Check,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mission, ScenarioType, MissionStatus } from '@/types/database'

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

export default function MissionSelector() {
  const pathname = usePathname()
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Detect current mission from URL
  const missionMatch = pathname.match(/\/missions\/([^/]+)/)
  const currentMissionId = missionMatch ? missionMatch[1] : null
  const currentMission = missions.find((m) => m.id === currentMissionId) ?? null

  // Detect current sub-page
  const subPageMatch = pathname.match(/\/missions\/[^/]+\/([^/]+)/)
  const currentSubPage = subPageMatch ? subPageMatch[1] : null

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions')
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) {
          setMissions(json.data)
        }
      }
    } catch {
      // Fail silently
    }
  }, [])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleSelectMission(mission: Mission) {
    setOpen(false)
    // Navigate to the same sub-page if applicable, otherwise the natural link
    if (currentSubPage) {
      router.push(`/missions/${mission.id}/${currentSubPage}`)
    } else {
      router.push(getMissionLink(mission))
    }
  }

  // Don't render if no missions
  if (missions.length === 0) {
    return null
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-all",
          "hover:bg-accent/70",
          open && "bg-accent/70",
          currentMission
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      >
        {currentMission ? (
          <>
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-muted-foreground",
            )}>
              {SCENARIO_ICONS[currentMission.scenario]}
            </span>
            <span className="max-w-[200px] truncate font-medium">
              {currentMission.name}
            </span>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              STATUS_DOT[currentMission.status]
            )} />
          </>
        ) : (
          <>
            <FolderOpen className="h-4 w-4" />
            <span className="font-medium">Missions</span>
          </>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          "absolute left-0 top-full z-50 mt-1.5 w-80",
          "rounded-xl border border-border bg-popover shadow-lg shadow-foreground/5",
          "animate-fade-in"
        )}>
          {/* Header */}
          <div className="border-b border-border/60 px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Missions ({missions.length})
            </span>
          </div>

          {/* Mission list */}
          <div className="max-h-[320px] overflow-y-auto py-1.5">
            {missions.map((mission) => {
              const isActive = mission.id === currentMissionId
              return (
                <button
                  key={mission.id}
                  onClick={() => handleSelectMission(mission)}
                  className={cn(
                    "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-primary/[0.06]"
                      : "hover:bg-accent/50"
                  )}
                >
                  {/* Scenario icon */}
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  )}>
                    {SCENARIO_ICONS[mission.scenario]}
                  </span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "truncate text-sm font-medium",
                        isActive ? "text-primary" : "text-popover-foreground"
                      )}>
                        {mission.name}
                      </span>
                      <span className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        STATUS_DOT[mission.status]
                      )} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {SCENARIO_LABELS[mission.scenario]}
                    </span>
                  </div>

                  {/* Check / Arrow */}
                  {isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer: back to missions list */}
          <div className="border-t border-border/60 px-3 py-2">
            <button
              onClick={() => {
                setOpen(false)
                router.push('/missions')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Voir toutes les missions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
