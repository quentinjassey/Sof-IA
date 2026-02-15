// app/api/missions/[id]/analysis/status/route.ts
// GET: Poll analysis status from N8N
// If N8N returns 'completed': fetch results, import to Supabase, update mission status
// Returns current status + progress

import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createN8NClient } from '@/lib/n8n/client'
import type { N8NStatusResponse, N8NResultsPayload } from '@/lib/n8n/types'
import {
  requireSession,
  requireMissionOwnership,
  createTrace,
  errorResponse,
  successResponse,
} from '@/lib/auth/helpers'

// ---------------------------------------------------------------
// GET /api/missions/[id]/analysis/status — Poll analysis status
// ---------------------------------------------------------------

export async function GET(
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

  // If mission is already analyzed or completed, return stored results
  if (['analyzed', 'in_review', 'completed'].includes(mission.status)) {
    return successResponse({
      status: 'completed',
      progress: {
        step: 'termine',
        step_number: 6,
        total_steps: 6,
        percent: 100,
        message: 'Pre-analyse terminee.',
      },
    })
  }

  // If mission is in a failed state, return the error
  if (mission.status === 'upload_failed') {
    return successResponse({
      status: 'failed',
      progress: {
        step: 'erreur',
        step_number: 0,
        total_steps: 6,
        percent: 0,
        message: 'L\'envoi des documents a echoue.',
      },
      error: 'L\'envoi des documents a echoue. Veuillez reessayer.',
      failure_type: 'upload_failed',
    })
  }

  if (mission.status === 'analysis_failed') {
    return successResponse({
      status: 'failed',
      progress: {
        step: 'erreur',
        step_number: 0,
        total_steps: 6,
        percent: 0,
        message: 'La pre-analyse a echoue.',
      },
      error: 'La pre-analyse a echoue. Veuillez reessayer.',
      failure_type: 'analysis_failed',
    })
  }

  // If mission is not in analyzing state, return current status
  if (mission.status !== 'analyzing') {
    return successResponse({
      status: mission.status,
      progress: {
        step: 'attente',
        step_number: 0,
        total_steps: 6,
        percent: 0,
        message: `Mission en statut "${mission.status}".`,
      },
    })
  }

  // Mission is in 'analyzing' state — poll N8N for status
  const analysisId = mission.analysis_id
  if (!analysisId) {
    return errorResponse(
      'Aucun identifiant d\'analyse trouve pour cette mission.',
      'INTERNAL_ERROR',
      500
    )
  }

  // Create N8N client with the user's license key
  const n8n = createN8NClient(session.license_key)

  let n8nStatus: N8NStatusResponse
  try {
    n8nStatus = await n8n.getAnalysisStatus(analysisId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('Erreur polling N8N status:', errorMessage)

    return successResponse({
      status: 'analyzing',
      progress: {
        step: 'attente',
        step_number: 0,
        total_steps: 6,
        percent: 0,
        message: 'En attente de reponse du serveur d\'analyse...',
      },
    })
  }

  // If N8N reports completion, import results into Supabase
  if (n8nStatus.status === 'completed') {
    const supabase = createServerSupabaseClient()

    // Return 'importing' status immediately — the actual import
    // happens here and the next poll will return 'completed'
    try {
      // Fetch full results from N8N
      const results = await n8n.getAnalysisResults(analysisId)

      // Import results into Supabase
      await importResultsToSupabase(missionId, session.license_id, results)

      // Update mission status to 'analyzed'
      await supabase
        .from('missions')
        .update({
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', missionId)

      // Create trace: analysis_completed
      await createTrace({
        mission_id: missionId,
        license_id: session.license_id,
        actor: 'sofia',
        actor_name: "Sof'IA",
        action: 'analysis_completed',
        target_type: 'mission',
        target_id: missionId,
        details: `Pre-analyse terminee. ${n8nStatus.results_summary?.signals_generated ?? 0} signaux detectes, ${n8nStatus.results_summary?.ecritures_parsed ?? 0} ecritures analysees.`,
      })

      return successResponse({
        status: 'completed',
        progress: {
          step: 'termine',
          step_number: 6,
          total_steps: 6,
          percent: 100,
          message: 'Pre-analyse terminee. Resultats importes.',
        },
        results_summary: n8nStatus.results_summary,
      })
    } catch (importError) {
      const errorMessage = importError instanceof Error ? importError.message : 'Erreur inconnue'
      console.error('Erreur import resultats N8N:', errorMessage)

      // Mark mission as failed
      await supabase
        .from('missions')
        .update({
          status: 'analysis_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', missionId)

      // Create trace: analysis_failed
      await createTrace({
        mission_id: missionId,
        license_id: session.license_id,
        actor: 'sofia',
        actor_name: "Sof'IA",
        action: 'analysis_failed',
        target_type: 'mission',
        target_id: missionId,
        details: `Erreur lors de l'importation des resultats : ${errorMessage}`,
      })

      return successResponse({
        status: 'failed',
        progress: {
          step: 'erreur',
          step_number: 0,
          total_steps: 6,
          percent: 0,
          message: 'Erreur lors de l\'importation des resultats.',
        },
        error: 'L\'importation des resultats a echoue. Vous pouvez reessayer.',
      })
    }
  }

  // If N8N reports failure
  if (n8nStatus.status === 'failed') {
    const supabase = createServerSupabaseClient()

    await supabase
      .from('missions')
      .update({
        status: 'analysis_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId)

    await createTrace({
      mission_id: missionId,
      license_id: session.license_id,
      actor: 'sofia',
      actor_name: "Sof'IA",
      action: 'analysis_failed',
      target_type: 'mission',
      target_id: missionId,
      details: `Pre-analyse echouee : ${n8nStatus.error ?? 'Erreur inconnue'}`,
    })

    return successResponse({
      status: 'failed',
      progress: n8nStatus.progress ?? {
        step: 'erreur',
        step_number: 0,
        total_steps: 6,
        percent: 0,
        message: 'La pre-analyse a echoue.',
      },
      error: n8nStatus.error ?? 'L\'analyse a echoue. Vous pouvez relancer la pre-analyse.',
    })
  }

  // N8N is still processing — return progress
  return successResponse({
    status: 'analyzing',
    progress: n8nStatus.progress ?? {
      step: 'traitement',
      step_number: 1,
      total_steps: 6,
      percent: 10,
      message: 'Pre-analyse en cours...',
    },
  })
}

// ---------------------------------------------------------------
// Import N8N results into Supabase tables
// ---------------------------------------------------------------

async function importResultsToSupabase(
  missionId: string,
  licenseId: string,
  results: N8NResultsPayload
): Promise<void> {
  const supabase = createServerSupabaseClient()

  // 1. Import completeness entries
  if (results.completeness && results.completeness.length > 0) {
    const completenessRows = results.completeness.map((entry) => ({
      mission_id: missionId,
      license_id: licenseId,
      doc_type: entry.type,
      label: entry.label,
      required: entry.required,
      status: entry.status,
      count: entry.count,
      note: entry.note ?? null,
    }))

    const { error: completenessError } = await supabase
      .from('completeness')
      .insert(completenessRows)

    if (completenessError) {
      console.error('Erreur import completeness:', completenessError.message)
    }
  }

  // 2. Import ecritures (FEC entries)
  // We need to map N8N ecriture IDs to new Supabase UUIDs
  const ecritureIdMap: Record<string, string> = {}

  if (results.ecritures && results.ecritures.length > 0) {
    // Find the FEC document in the mission to link ecritures
    const { data: fecDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('mission_id', missionId)
      .eq('type', 'fec')
      .limit(1)
      .single()

    const ecritureRows = results.ecritures.map((entry) => ({
      mission_id: missionId,
      license_id: licenseId,
      document_id: fecDoc?.id ?? null,
      journal_code: entry.journal_code,
      journal_lib: entry.journal_lib,
      ecriture_num: entry.ecriture_num,
      ecriture_date: entry.ecriture_date,
      compte_num: entry.compte_num,
      compte_lib: entry.compte_lib,
      comp_aux_num: entry.comp_aux_num,
      comp_aux_lib: entry.comp_aux_lib,
      piece_ref: entry.piece_ref,
      piece_date: entry.piece_date,
      ecriture_lib: entry.ecriture_lib,
      debit: entry.debit,
      credit: entry.credit,
      lettrage: entry.lettrage,
      date_lettrage: entry.date_lettrage,
      valid_date: entry.valid_date,
    }))

    const { data: insertedEcritures, error: ecrituresError } = await supabase
      .from('ecritures')
      .insert(ecritureRows)
      .select('id')

    if (ecrituresError) {
      console.error('Erreur import ecritures:', ecrituresError.message)
    } else if (insertedEcritures) {
      // Map N8N IDs to Supabase IDs
      for (let i = 0; i < results.ecritures.length && i < insertedEcritures.length; i++) {
        ecritureIdMap[results.ecritures[i].id] = insertedEcritures[i].id
      }
    }
  }

  // 3. Import rapprochements
  const rapprochementIdMap: Record<string, string> = {}

  if (results.rapprochements && results.rapprochements.length > 0) {
    const rapprochementRows = results.rapprochements.map((entry) => ({
      mission_id: missionId,
      license_id: licenseId,
      ecriture_id: ecritureIdMap[entry.ecriture_id] ?? entry.ecriture_id,
      document_id: entry.document_id,
      match_type: entry.match_type,
      match_details: entry.match_details,
      confidence: entry.confidence,
      created_by: 'sofia',
    }))

    const { data: insertedRapprochements, error: rapprError } = await supabase
      .from('rapprochements')
      .insert(rapprochementRows)
      .select('id')

    if (rapprError) {
      console.error('Erreur import rapprochements:', rapprError.message)
    } else if (insertedRapprochements) {
      for (let i = 0; i < results.rapprochements.length && i < insertedRapprochements.length; i++) {
        rapprochementIdMap[results.rapprochements[i].id] = insertedRapprochements[i].id
      }
    }
  }

  // 4. Import signals
  if (results.signals && results.signals.length > 0) {
    const signalRows = results.signals.map((signal) => ({
      mission_id: missionId,
      license_id: licenseId,
      document_id: signal.document_id,
      ecriture_id: signal.ecriture_id ? (ecritureIdMap[signal.ecriture_id] ?? signal.ecriture_id) : null,
      rapprochement_id: signal.rapprochement_id ? (rapprochementIdMap[signal.rapprochement_id] ?? signal.rapprochement_id) : null,
      type: signal.type,
      description: signal.description,
      source_document: signal.source_document,
      source_page: signal.source_page,
      source_extract: signal.source_extract,
      rule_triggered: signal.rule_triggered,
      rule_description: signal.rule_description,
      priority: signal.priority,
      explicability: signal.explicability,
      human_decision: 'pending' as const,
      human_comment: null,
      decided_at: null,
    }))

    const { error: signalsError } = await supabase
      .from('signals')
      .insert(signalRows)

    if (signalsError) {
      console.error('Erreur import signals:', signalsError.message)
    }
  }

  // 5. Import deliverables (files to Storage + metadata to DB)
  if (results.deliverables && results.deliverables.length > 0) {
    for (const deliverable of results.deliverables) {
      let storagePath: string | null = null

      // Upload base64 file to Supabase Storage
      if (deliverable.file_base64) {
        const extension = deliverable.format === 'xlsx' ? 'xlsx' : 'pdf'
        storagePath = `deliverables/${missionId}/${deliverable.type}.${extension}`

        const fileBuffer = Buffer.from(deliverable.file_base64, 'base64')
        const contentType = deliverable.format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'

        const { error: uploadError } = await supabase.storage
          .from('deliverables')
          .upload(storagePath, fileBuffer, {
            contentType,
            upsert: true,
          })

        if (uploadError) {
          console.error(`Erreur upload livrable ${deliverable.type}:`, uploadError.message)
          storagePath = null
        }
      }

      // Insert deliverable metadata
      const { error: delivInsertError } = await supabase
        .from('deliverables')
        .insert({
          mission_id: missionId,
          license_id: licenseId,
          type: deliverable.type,
          format: deliverable.format,
          title: deliverable.title,
          generated_at: new Date().toISOString(),
          content_json: deliverable.content_json,
          storage_path: storagePath,
        })

      if (delivInsertError) {
        console.error(`Erreur insertion livrable ${deliverable.type}:`, delivInsertError.message)
      }
    }
  }

  // 6. Import traces (Sofia actions)
  if (results.traces && results.traces.length > 0) {
    const traceRows = results.traces.map((trace) => ({
      mission_id: missionId,
      license_id: licenseId,
      timestamp: trace.timestamp,
      actor: trace.actor || 'sofia',
      actor_name: "Sof'IA",
      action: trace.action,
      target_type: 'mission' as const,
      target_id: missionId,
      details: trace.details,
    }))

    const { error: tracesError } = await supabase
      .from('traces')
      .insert(traceRows)

    if (tracesError) {
      console.error('Erreur import traces:', tracesError.message)
    }
  }
}
