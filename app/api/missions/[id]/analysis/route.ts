// app/api/missions/[id]/analysis/route.ts
// POST: Start analysis
//   1. Generate signed URLs for all mission documents (1h validity)
//   2. Send to N8N webhook: POST /missions/analyze
//   3. Update mission status to 'analyzing'
//   4. Create trace: actor='user', action='analysis_started'
//   5. Return { analysis_id, status }

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createN8NClient } from '@/lib/n8n/client'
import {
  requireSession,
  requireMissionOwnership,
  getActorName,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'
import type { ScenarioType, SignalPriority } from '@/types/database'
import { analyzePointageMission } from '@/lib/services/pointage-analyzer'

// ---------------------------------------------------------------
// POST /api/missions/[id]/analysis — Launch pre-analysis
// ---------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params

  let session
  try {
    session = await requireSession(req)
  } catch (response) {
    return response as Response
  }

  let mission
  try {
    mission = await requireMissionOwnership(missionId, session.license_id)
  } catch (response) {
    return response as Response
  }

  // Verify mission is in a valid state for analysis
  const validStatesForAnalysis = ['created', 'documents_ready', 'upload_failed', 'analysis_failed']
  if (!validStatesForAnalysis.includes(mission.status)) {
    if (mission.status === 'analyzing') {
      return errorResponse(
        'Une analyse est deja en cours pour cette mission.',
        'ANALYSIS_IN_PROGRESS',
        409
      )
    }
    return errorResponse(
      `Impossible de lancer une analyse pour une mission en statut "${mission.status}".`,
      'VALIDATION_ERROR',
      400
    )
  }

  const supabase = createServerSupabaseClient()

  // Get all documents for the mission
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .eq('mission_id', missionId)

  if (docsError) {
    return errorResponse(
      'Erreur lors de la recuperation des documents.',
      'INTERNAL_ERROR',
      500
    )
  }

  if (!documents || documents.length === 0) {
    return errorResponse(
      'Aucun document n\'a ete ajoute a cette mission. Ajoutez au moins un document avant de lancer la pre-analyse.',
      'VALIDATION_ERROR',
      400
    )
  }

  // --- POINTAGE BYPASS: Local analysis without N8N ---
  if (mission.scenario === 'pointage' && mission.company_id) {
    // Update status to analyzing
    await supabase
      .from('missions')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', missionId)

    // Create trace: analysis_started
    const actorNamePointage = await getActorName(session.license_id)
    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'user',
      actor_name: actorNamePointage,
      action: 'analysis_started',
      target_type: 'mission',
      target_id: missionId,
      details: `Pre-analyse lancee sur ${documents?.length || 0} document(s) — Scenario : pointage (analyse locale)`,
    })

    try {
      const result = await analyzePointageMission(
        supabase,
        missionId,
        session.license_id,
        mission.company_id
      )

      return successResponse(
        {
          analysis_id: missionId,
          status: 'analyzed' as const,
          signals_count: result.signals_count,
          company_name: result.company_name,
        },
        200
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error('Erreur analyse pointage locale:', errorMessage)

      await supabase
        .from('missions')
        .update({ status: 'analysis_failed', updated_at: new Date().toISOString() })
        .eq('id', missionId)

      return errorResponse(
        'Erreur lors de la pre-analyse locale des etats financiers.',
        'ANALYSIS_FAILED',
        500
      )
    }
  }

  // --- STANDARD N8N ANALYSIS (sondage_ca, cutoff) ---

  // Generate signed URLs for each document (1 hour validity = 3600 seconds)
  const documentRefs = []
  for (const doc of documents) {
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 3600) // 1 hour

    if (signError || !signedUrlData) {
      console.error(`Erreur generation URL signee pour ${doc.filename}:`, signError?.message)
      return errorResponse(
        `Impossible de generer une URL d'acces pour le document "${doc.filename}".`,
        'INTERNAL_ERROR',
        500
      )
    }

    documentRefs.push({
      id: doc.id,
      type: doc.type,
      filename: doc.filename,
      download_url: signedUrlData.signedUrl,
    })
  }

  // Update mission status to 'analyzing' before calling N8N
  await supabase
    .from('missions')
    .update({
      status: 'analyzing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  // Parse optional analysis options from request body
  let analysisOptions: { cutoff_window_days?: number; priority_threshold?: SignalPriority } = {}
  try {
    const body = await req.json()
    if (body.options) {
      analysisOptions = body.options
    }
  } catch {
    // No body or invalid JSON — proceed with default options
  }

  // Create N8N client with the user's license key
  const n8n = createN8NClient(session.license_key)

  // Send to N8N webhook
  let n8nResponse
  try {
    n8nResponse = await n8n.startAnalysis({
      mission_id: missionId,
      scenario: mission.scenario as ScenarioType,
      documents: documentRefs,
      options: {
        cutoff_window_days: analysisOptions.cutoff_window_days ?? 10,
        priority_threshold: analysisOptions.priority_threshold ?? 'low',
      },
    })
  } catch (error) {
    // N8N call failed — revert mission status
    await supabase
      .from('missions')
      .update({
        status: 'analysis_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId)

    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Erreur appel N8N /missions/analyze:', errorMessage)

    return errorResponse(
      'Erreur lors du lancement de la pre-analyse. Le serveur d\'analyse n\'est pas accessible.',
      'ANALYSIS_FAILED',
      502
    )
  }

  const analysisId = n8nResponse?.analysis_id

  // Store analysis_id in the mission
  if (analysisId) {
    await supabase
      .from('missions')
      .update({
        analysis_id: analysisId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId)
  }

  // Create trace: analysis_started
  const actorName = await getActorName(session.license_id)
  await createTrace({
    mission_id: missionId,
    license_id: session.license_id,
    actor: 'user',
    actor_name: actorName,
    action: 'analysis_started',
    target_type: 'mission',
    target_id: missionId,
    details: `Pre-analyse lancee sur ${documents.length} document(s) — Scenario : ${mission.scenario}`,
  })

  return successResponse(
    {
      analysis_id: analysisId || missionId,
      status: 'analyzing' as const,
    },
    202
  )
}
