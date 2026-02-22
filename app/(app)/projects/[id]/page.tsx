'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderOpen,
  Upload,
  FileText,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import DisclaimerBanner from '@/components/ui/DisclaimerBanner'
import AnalysisCard from '@/components/projects/AnalysisCard'
import AnalysisLauncher from '@/components/projects/AnalysisLauncher'
import { useProjectContext } from './layout'
import type { ScenarioType, Mission } from '@/types/database'

const SCENARIOS: ScenarioType[] = ['sondage_ca', 'cutoff', 'pointage']

export default function ProjectDetailPage() {
  const router = useRouter()
  const { projectId, documents, missions, refreshProject, isLoading, projectName } =
    useProjectContext()

  const [launcherScenario, setLauncherScenario] = useState<ScenarioType | null>(null)
  const [launchingScenario, setLaunchingScenario] = useState<ScenarioType | null>(null)
  const [signalCounts, setSignalCounts] = useState<Record<string, number>>({})

  const missionsByScenario = useMemo(() => {
    const map: Partial<Record<ScenarioType, Mission>> = {}
    for (const m of missions) {
      map[m.scenario as ScenarioType] = m
    }
    return map
  }, [missions])

  // Fetch signal counts for analyzed missions
  useEffect(() => {
    const analyzedMissions = missions.filter((m) =>
      ['analyzed', 'in_review', 'completed'].includes(m.status)
    )
    if (analyzedMissions.length === 0) return

    Promise.all(
      analyzedMissions.map(async (m) => {
        try {
          const res = await fetch(`/api/missions/${m.id}/signals?limit=0`)
          if (res.ok) {
            const json = await res.json()
            return { missionId: m.id, count: json.data?.total ?? json.data?.length ?? 0 }
          }
        } catch {
          // Silent
        }
        return { missionId: m.id, count: 0 }
      })
    ).then((results) => {
      const counts: Record<string, number> = {}
      for (const r of results) {
        if (r) counts[r.missionId] = r.count
      }
      setSignalCounts(counts)
    })
  }, [missions])

  const handleLaunchAnalysis = useCallback(
    (scenario: ScenarioType) => {
      if (documents.length === 0) {
        alert('Ajoutez des documents au projet avant de lancer une analyse.')
        return
      }
      setLauncherScenario(scenario)
    },
    [documents]
  )

  const handleConfirmLaunch = useCallback(
    async (documentIds: string[]) => {
      if (!launcherScenario) return

      setLaunchingScenario(launcherScenario)

      try {
        // Create mission if it doesn't exist
        let mission = missionsByScenario[launcherScenario]

        if (!mission) {
          const createRes = await fetch(`/api/projects/${projectId}/missions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario: launcherScenario }),
          })
          const createJson = await createRes.json()
          if (!createRes.ok) throw new Error(createJson.error || 'Erreur creation mission')
          mission = createJson.data
        }

        // Launch analysis with selected document IDs
        const analysisRes = await fetch(`/api/missions/${mission!.id}/analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_ids: documentIds }),
        })
        const analysisJson = await analysisRes.json()
        if (!analysisRes.ok) throw new Error(analysisJson.error || 'Erreur lancement analyse')

        setLauncherScenario(null)
        await refreshProject()

        // If analysis completed synchronously (pointage/cutoff local), stay on project page
        if (analysisJson.data?.status === 'analyzed') {
          await refreshProject()
        } else {
          // Redirect to analysis progress page
          router.push(`/projects/${projectId}/missions/${mission!.id}/analysis`)
        }
      } catch (err) {
        throw err
      } finally {
        setLaunchingScenario(null)
      }
    },
    [launcherScenario, missionsByScenario, projectId, refreshProject, router]
  )

  const handleRelaunch = useCallback(
    (mission: Mission) => {
      setLauncherScenario(mission.scenario as ScenarioType)
    },
    []
  )

  const handleViewResults = useCallback(
    (mission: Mission) => {
      router.push(`/projects/${projectId}/missions/${mission.id}/signals`)
    },
    [router, projectId]
  )

  const handleUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.txt,.csv,.pdf,.jpg,.jpeg,.png,.tiff,.tif'
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append('files', file)
      }

      try {
        await fetch(`/api/projects/${projectId}/documents`, {
          method: 'POST',
          body: formData,
        })
        await refreshProject()
      } catch {
        // Silent fail
      }
    }
    input.click()
  }, [projectId, refreshProject])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="mt-3 text-sm text-muted-foreground">Chargement du projet...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FolderOpen className="h-6 w-6 text-primary" />
          <h1 className="font-serif text-2xl tracking-tight text-foreground">{projectName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? 's' : ''} ·{' '}
          {missions.length} analyse{missions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Upload zone when no documents */}
      {documents.length === 0 && (
        <div className="mb-8">
          <button
            onClick={handleUpload}
            className={cn(
              'flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-border py-12 transition-all',
              'hover:border-primary/40 hover:bg-primary/[0.02]'
            )}
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Ajoutez vos documents
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              FEC, factures, bons de livraison, bilans, annexes...
            </p>
          </button>
        </div>
      )}

      {/* Quick doc summary when docs exist */}
      {documents.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Bibliotheque de documents</p>
            <p className="text-xs text-muted-foreground">
              {documents.length} fichier{documents.length !== 1 ? 's' : ''} classes automatiquement.
              Utilisez le panneau de gauche pour gerer vos documents.
            </p>
          </div>
          <button
            onClick={handleUpload}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Upload className="mr-1.5 inline-block h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
      )}

      {/* Disclaimer */}
      <DisclaimerBanner />

      {/* Analyses grid */}
      <div className="mt-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
          Analyses disponibles
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SCENARIOS.map((scenario) => {
            const mission = missionsByScenario[scenario]
            return (
              <AnalysisCard
                key={scenario}
                scenario={scenario}
                mission={mission}
                signalCount={mission ? signalCounts[mission.id] : undefined}
                onLaunch={handleLaunchAnalysis}
                onRelaunch={handleRelaunch}
                onViewResults={handleViewResults}
                isLaunching={launchingScenario === scenario}
              />
            )
          })}
        </div>
      </div>

      {/* Analysis launcher modal */}
      {launcherScenario && (
        <AnalysisLauncher
          isOpen={!!launcherScenario}
          onClose={() => setLauncherScenario(null)}
          scenario={launcherScenario}
          documents={documents}
          onConfirm={handleConfirmLaunch}
        />
      )}
    </div>
  )
}
