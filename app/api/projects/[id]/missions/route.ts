import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireProjectOwnership,
  getActorName,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { ScenarioType } from '@/types/database'

const VALID_SCENARIOS: ScenarioType[] = ['sondage_ca', 'cutoff', 'pointage']

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

// GET /api/projects/[id]/missions — List missions for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  try {
    await requireProjectOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse('Erreur lors de la recuperation des missions.', 'INTERNAL_ERROR', 500)
  }

  return successResponse(missions ?? [])
}

// POST /api/projects/[id]/missions — Create a mission within a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let project
  try {
    project = await requireProjectOwnership(projectId, session.license_id)
  } catch (response) {
    return response as Response
  }

  let body: { scenario?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete invalide.', 'VALIDATION_ERROR', 400)
  }

  const { scenario } = body

  if (!scenario || !VALID_SCENARIOS.includes(scenario as ScenarioType)) {
    return errorResponse(
      `Le champ "scenario" doit etre l'un de : ${VALID_SCENARIOS.join(', ')}.`,
      'VALIDATION_ERROR',
      400
    )
  }

  const validScenario = scenario as ScenarioType

  const supabase = createServerSupabaseClient()

  // Check license features
  const { data: license, error: licenseError } = await supabase
    .from('licenses')
    .select('features, status')
    .eq('id', session.license_id)
    .single()

  if (licenseError || !license || license.status !== 'active') {
    return errorResponse('Licence invalide ou inactive.', 'UNAUTHORIZED', 401)
  }

  const features = license.features as string[]
  if (!features.includes(validScenario)) {
    return errorResponse(
      `Votre licence n'autorise pas le scenario "${validScenario}".`,
      'FORBIDDEN',
      403
    )
  }

  // Check if a mission with this scenario already exists in the project
  const { data: existingMission } = await supabase
    .from('missions')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('scenario', validScenario)
    .single()

  if (existingMission) {
    return successResponse(existingMission)
  }

  const now = new Date().toISOString()
  const missionName = `${project.name} — ${SCENARIO_LABELS[validScenario]}`

  const { data: mission, error: insertError } = await supabase
    .from('missions')
    .insert({
      license_id: session.license_id,
      project_id: projectId,
      name: missionName,
      scenario: validScenario,
      status: 'created' as const,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single()

  if (insertError || !mission) {
    return errorResponse('Erreur lors de la creation de la mission.', 'INTERNAL_ERROR', 500)
  }

  const actorName = await getActorName(session.license_id)
  await createTrace({
    mission_id: mission.id,
    license_id: session.license_id,
    actor: 'user',
    actor_name: actorName,
    action: 'mission_created',
    target_type: 'mission',
    target_id: mission.id,
    details: `Mission creee : "${missionName}" — Scenario : ${SCENARIO_LABELS[validScenario]}`,
  })

  return successResponse(mission, 201)
}
