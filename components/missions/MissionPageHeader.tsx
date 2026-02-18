'use client'

import { useState, useEffect } from 'react'
import { CompanyLogo, extractCompanyFromTitle } from '@/components/missions/CompanyLogo'

interface MissionInfo {
  name: string
  scenario?: string
  company_id?: string | null
}

const SCENARIO_LABELS: Record<string, string> = {
  sondage_ca: "Sondage sur le chiffre d'affaires",
  cutoff: "Césure d'exercice (cut-off)",
  pointage: "Pointage des états financiers",
}

interface MissionPageHeaderProps {
  /** The page title, e.g. "Documents de la mission" */
  title: React.ReactNode
  /** Override the auto-generated subtitle (mission name + scenario) */
  subtitle?: React.ReactNode
  /** Mission ID used to auto-fetch mission info when `mission` prop is not provided */
  missionId: string
  /** Pass mission data if already available in the parent — avoids an extra fetch */
  mission?: MissionInfo | null
  /** Extra content aligned to the right of the header row */
  actions?: React.ReactNode
}

/**
 * Shared page header for all mission sub-pages.
 * Displays a company logo (fetched via /api/logo), a title and a subtitle.
 * If mission data is not passed as a prop it fetches it automatically.
 */
export function MissionPageHeader({
  title,
  subtitle,
  missionId,
  mission: missionProp,
  actions,
}: MissionPageHeaderProps) {
  const [mission, setMission] = useState<MissionInfo | null>(missionProp ?? null)

  useEffect(() => {
    if (missionProp !== undefined) {
      setMission(missionProp)
      return
    }
    fetch(`/api/missions/${missionId}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setMission(j.data) })
      .catch(() => {})
  }, [missionId, missionProp])

  const companyName = mission?.company_id
    ? mission.company_id
    : mission
      ? extractCompanyFromTitle(mission.name)
      : ''

  const defaultSubtitle = mission
    ? `${mission.name}${mission.scenario ? ` — ${SCENARIO_LABELS[mission.scenario] ?? mission.scenario}` : ''}`
    : undefined

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        {/* Logo — shown as soon as company name is resolved */}
        {companyName ? (
          <CompanyLogo
            name={companyName}
            className="h-12 w-12 shrink-0 rounded-xl shadow-sm ring-1 ring-border/50"
          />
        ) : (
          /* Skeleton placeholder to avoid layout shift while mission loads */
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
        )}

        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
          {(subtitle ?? defaultSubtitle) && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {subtitle ?? defaultSubtitle}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
