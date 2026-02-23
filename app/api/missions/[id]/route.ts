// app/api/missions/[id]/route.ts
// GET:    Get mission detail with stats (verify ownership by license_id)
// PUT:    Update mission (name, status)
// DELETE: Delete mission (only if status is 'created')

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  requireSession,
  requireMissionOwnership,
  getActorName,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { MissionStatus } from '@/types/database'

// ---------------------------------------------------------------
// GET /api/missions/[id] — Get mission detail with stats
// ---------------------------------------------------------------

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

  let mission
  try {
    mission = await requireMissionOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Fetch stats for the mission
  const supabase = createServerSupabaseClient()

  // Count documents: project-based missions use project_id, legacy uses mission_id
  let documentsCountQuery = supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  if (mission.project_id) {
    documentsCountQuery = documentsCountQuery.eq('project_id', mission.project_id)
  } else {
    documentsCountQuery = documentsCountQuery.eq('mission_id', id)
  }

  const { count: documentsCount } = await documentsCountQuery

  // Count signals and group by priority and decision
  const { data: signals } = await supabase
    .from('signals')
    .select('priority, human_decision')
    .eq('mission_id', id)

  const signalsList = signals ?? []
  const signalsCount = signalsList.length

  const signalsByPriority = {
    high: signalsList.filter((s) => s.priority === 'high').length,
    medium: signalsList.filter((s) => s.priority === 'medium').length,
    low: signalsList.filter((s) => s.priority === 'low').length,
  }

  const signalsByDecision = {
    pending: signalsList.filter((s) => s.human_decision === 'pending').length,
    validated: signalsList.filter((s) => s.human_decision === 'validated').length,
    rejected: signalsList.filter((s) => s.human_decision === 'rejected').length,
    to_investigate: signalsList.filter((s) => s.human_decision === 'to_investigate').length,
  }

  const missionWithStats = {
    ...mission,
    stats: {
      documents_count: documentsCount ?? 0,
      signals_count: signalsCount,
      signals_by_priority: signalsByPriority,
      signals_by_decision: signalsByDecision,
    },
  }

  return successResponse(missionWithStats)
}

// ---------------------------------------------------------------
// PUT /api/missions/[id] — Update mission (name, status)
// ---------------------------------------------------------------

export async function PUT(
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

  let mission
  try {
    mission = await requireMissionOwnership(id, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Parse request body
  let body: { name?: string; status?: MissionStatus }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Corps de requete invalide.', 'VALIDATION_ERROR', 400)
  }

  // Build update object
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return errorResponse(
        'Le champ "name" doit etre une chaine non vide.',
        'VALIDATION_ERROR',
        400
      )
    }
    updateFields.name = body.name.trim()
  }

  if (body.status !== undefined) {
    const validStatuses: MissionStatus[] = [
      'created',
      'documents_ready',
      'uploading',
      'upload_failed',
      'analyzing',
      'analysis_failed',
      'analyzed',
      'in_review',
      'completed',
    ]
    if (!validStatuses.includes(body.status)) {
      return errorResponse(
        `Le champ "status" doit etre l'un de : ${validStatuses.join(', ')}.`,
        'VALIDATION_ERROR',
        400
      )
    }
    updateFields.status = body.status
  }

  // Apply update
  const supabase = createServerSupabaseClient()

  const { data: updatedMission, error } = await supabase
    .from('missions')
    .update(updateFields)
    .eq('id', id)
    .eq('license_id', session.license_id)
    .select()
    .single()

  if (error || !updatedMission) {
    return errorResponse(
      'Erreur lors de la mise a jour de la mission.',
      'INTERNAL_ERROR',
      500
    )
  }

  // Create trace for name changes
  if (body.name && body.name.trim() !== mission.name) {
    const actorName = await getActorName(session.license_id)
    await createTrace({
      mission_id: id,
      license_id: session.license_id,
      actor: 'user',
      actor_name: actorName,
      action: 'mission_updated',
      target_type: 'mission',
      target_id: id,
      details: `Mission renommee : "${mission.name}" → "${body.name.trim()}"`,
    })
  }

  return successResponse(updatedMission)
}

// ---------------------------------------------------------------
// DELETE /api/missions/[id] — Delete mission (only if status = 'created')
// ---------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    let session
    try {
      session = await requireSession(req)
    } catch (response) {
      return response as Response
    }

    let mission
    try {
      mission = await requireMissionOwnership(id, session.license_id)
    } catch (response) {
      return response as Response
    }

    if (mission.status !== 'created') {
      return errorResponse(
        `Impossible de supprimer une mission en statut "${mission.status}". Seules les missions au statut "created" peuvent etre supprimees.`,
        'FORBIDDEN',
        403
      )
    }

    const supabase = createServerSupabaseClient()

    // Use the safely_delete_mission function to handle the traces
    // immutability trigger (traces_no_delete) which blocks ON DELETE CASCADE.
    const { data: deleted, error } = await supabase
      .rpc('safely_delete_mission', {
        p_mission_id: id,
        p_license_id: session.license_id,
      })

    if (error) {
      console.error(`[DELETE] Supabase RPC error: ${JSON.stringify(error)}`)
      return errorResponse(
        'Erreur lors de la suppression de la mission.',
        'INTERNAL_ERROR',
        500
      )
    }

    if (deleted === false) {
      return errorResponse(
        'Mission non trouvee ou non supprimable.',
        'NOT_FOUND',
        404
      )
    }

    return successResponse({ success: true as const })
  } catch (err) {
    console.error(`[DELETE] Unexpected error:`, err)
    return errorResponse(
      'Erreur interne lors de la suppression.',
      'INTERNAL_ERROR',
      500
    )
  }
}
