// app/api/missions/route.ts
// GET:  List all missions for the current license_id
// POST: Create a new mission (with trace entry)

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  getActorName,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { ScenarioType } from '@/types/database'
import { getRandomCompany } from '@/lib/config/pointage-companies'

// Valid scenario values
const VALID_SCENARIOS: ScenarioType[] = ['sondage_ca', 'cutoff', 'pointage']

// Scenario labels for trace details
const SCENARIO_LABELS: Record<ScenarioType, string> = {
  sondage_ca: 'Sondage sur le chiffre d\'affaires',
  cutoff: 'Cesure d\'exercice (cut-off)',
  pointage: 'Pointage des etats financiers',
}

// ---------------------------------------------------------------
// GET /api/missions — List all missions for the current license
// ---------------------------------------------------------------

export async function GET(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  const supabase = createServerSupabaseClient()

  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('license_id', session.license_id)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResponse(
      'Erreur lors de la recuperation des missions.',
      'INTERNAL_ERROR',
      500
    )
  }

  return successResponse(missions ?? [])
}

// ---------------------------------------------------------------
// POST /api/missions — Create a new mission
// ---------------------------------------------------------------

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  // Parse request body
  let body: { name?: string; scenario?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse(
      'Corps de requete invalide.',
      'VALIDATION_ERROR',
      400
    )
  }

  // Validate required fields
  const { name, scenario, description } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return errorResponse(
      'Le champ "name" est requis et doit etre une chaine non vide.',
      'VALIDATION_ERROR',
      400
    )
  }

  if (!scenario || !VALID_SCENARIOS.includes(scenario as ScenarioType)) {
    return errorResponse(
      `Le champ "scenario" doit etre l'un de : ${VALID_SCENARIOS.join(', ')}.`,
      'VALIDATION_ERROR',
      400
    )
  }

  const validScenario = scenario as ScenarioType

  // Check license features allow this scenario
  const supabase = createServerSupabaseClient()

  const { data: license, error: licenseError } = await supabase
    .from('licenses')
    .select('features, max_missions, status')
    .eq('id', session.license_id)
    .single()

  if (licenseError || !license) {
    return errorResponse(
      'Licence introuvable.',
      'UNAUTHORIZED',
      401
    )
  }

  if (license.status !== 'active') {
    return errorResponse(
      'Votre licence n\'est plus active.',
      'UNAUTHORIZED',
      401
    )
  }

  // Check if scenario is allowed by license features
  const features = license.features as string[]
  if (!features.includes(validScenario)) {
    return errorResponse(
      `Votre licence n'autorise pas le scenario "${validScenario}".`,
      'FORBIDDEN',
      403
    )
  }

  // Check mission count limit (if applicable)
  if (license.max_missions > 0) {
    const { count: missionCount } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('license_id', session.license_id)

    if (missionCount !== null && missionCount >= license.max_missions) {
      return errorResponse(
        `Nombre maximum de missions atteint (${license.max_missions}).`,
        'FORBIDDEN',
        403
      )
    }
  }

  // For pointage scenario, assign a random company
  let companyId: string | null = null
  if (validScenario === 'pointage') {
    const company = getRandomCompany()
    companyId = company.id
  }

  // Create the mission
  const now = new Date().toISOString()
  const missionInsert = {
    license_id: session.license_id,
    name: name.trim(),
    scenario: validScenario,
    status: 'created' as const,
    company_id: companyId,
    created_at: now,
    updated_at: now,
    ...(description ? {} : {}), // description is not in the DB schema; it's ignored
  }

  const { data: mission, error: insertError } = await supabase
    .from('missions')
    .insert(missionInsert)
    .select()
    .single()

  if (insertError || !mission) {
    return errorResponse(
      'Erreur lors de la creation de la mission.',
      'INTERNAL_ERROR',
      500
    )
  }

  // Create trace entry: mission_created
  const actorName = await getActorName(session.license_id)
  await createTrace({
    mission_id: mission.id,
    license_id: session.license_id,
    actor: 'user',
    actor_name: actorName,
    action: 'mission_created',
    target_type: 'mission',
    target_id: mission.id,
    details: `Mission creee : "${mission.name}" — Scenario : ${SCENARIO_LABELS[validScenario]}`,
  })

  return successResponse(mission, 201)
}
