// app/api/missions/[id]/analysis/status/route.ts
// GET: Poll analysis status
//
// For sondage_ca scenario (N8N-based):
//   1. Reads n8n_analysis_state directly from Supabase (no N8N webhook needed)
//   2. When status='completed' and results_json is present:
//      → Transform N8N consolidation output → import into Supabase tables
//      → Update mission status to 'analyzed'
//   3. Returns current progress for the polling UI
//
// For pointage/cutoff (local analysis):
//   Returns the mission status directly (no async polling needed)

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
import {
  transformN8NResults,
  type N8NResults,
} from '@/lib/services/n8n-results-transformer'
import { generateAllDeliverables } from '@/lib/services/deliverable-generator'

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

  // If mission is already analyzed or completed, return immediately
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

  // Mission is in 'analyzing' state — read progress from n8n_analysis_state
  const analysisId = mission.analysis_id
  if (!analysisId) {
    return errorResponse(
      'Aucun identifiant d\'analyse trouve pour cette mission.',
      'INTERNAL_ERROR',
      500
    )
  }

  const supabase = createServerSupabaseClient()

  // Read analysis state directly from Supabase (no N8N webhook needed)
  const { data: analysisState, error: stateError } = await supabase
    .from('n8n_analysis_state')
    .select('*')
    .eq('analysis_id', analysisId)
    .single()

  if (stateError || !analysisState) {
    // Fallback: try by mission_id
    const { data: fallbackState } = await supabase
      .from('n8n_analysis_state')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!fallbackState) {
      return successResponse({
        status: 'analyzing',
        progress: {
          step: 'attente',
          step_number: 0,
          total_steps: 6,
          percent: 0,
          message: 'En attente du demarrage de l\'analyse...',
        },
      })
    }

    // Use fallback state
    return handleAnalysisState(fallbackState, missionId, session.license_id)
  }

  return handleAnalysisState(analysisState, missionId, session.license_id)
}

// ---------------------------------------------------------------
// Handle analysis state from n8n_analysis_state table
// ---------------------------------------------------------------

interface AnalysisStateRow {
  analysis_id: string
  mission_id: string
  status: string
  current_step: number | null
  current_step_key: string | null
  progress_percent: number | null
  progress_message: string | null
  results_json: N8NResults | null
  error_message: string | null
  completed_at: string | null
}

async function handleAnalysisState(
  state: AnalysisStateRow,
  missionId: string,
  licenseId: string
) {
  const supabase = createServerSupabaseClient()

  // If N8N marked as completed AND results are present → import
  if (state.status === 'completed' && state.results_json) {
    try {
      const transformed = transformN8NResults(state.results_json)
      await importTransformedResults(missionId, licenseId, transformed)

      // Generate all 4 deliverables (PDF/XLSX) and upload to Supabase Storage
      let deliverablesGenerated = 0
      try {
        const deliverables = await generateAllDeliverables(supabase, missionId, licenseId)
        deliverablesGenerated = deliverables.length
      } catch (deliverableError) {
        console.error('Erreur generation livrables (non-bloquante):', deliverableError)
      }

      // Update mission status to 'analyzed'
      await supabase
        .from('missions')
        .update({ status: 'analyzed', updated_at: new Date().toISOString() })
        .eq('id', missionId)

      // Create trace: analysis_completed
      await createTrace({
        mission_id: missionId,
        license_id: licenseId,
        actor: 'sofia',
        actor_name: "Sof'IA",
        action: 'analysis_completed',
        target_type: 'mission',
        target_id: missionId,
        details: `Pre-analyse terminee. ${transformed.signals.length} signaux detectes sur ${transformed.summary.pieces_testees} pieces testees. Couverture CA : ${transformed.summary.couverture_pct?.toFixed(2) || '?'}%. ${deliverablesGenerated} livrable(s) genere(s).`,
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
        results_summary: {
          signals_generated: transformed.signals.length,
          ecritures_parsed: transformed.summary.total_ecritures_fec,
          pieces_testees: transformed.summary.pieces_testees,
          couverture_ca_pct: transformed.summary.couverture_pct,
          deliverables_generated: deliverablesGenerated,
        },
      })
    } catch (importError) {
      const errorMessage = importError instanceof Error ? importError.message : 'Erreur inconnue'
      console.error('Erreur import resultats N8N:', errorMessage)

      await supabase
        .from('missions')
        .update({ status: 'analysis_failed', updated_at: new Date().toISOString() })
        .eq('id', missionId)

      await createTrace({
        mission_id: missionId,
        license_id: licenseId,
        actor: 'sofia',
        actor_name: "Sof'IA",
        action: 'analysis_failed',
        target_type: 'mission',
        target_id: missionId,
        details: `Erreur lors de l'importation des resultats : ${errorMessage}`,
      })

      return successResponse({
        status: 'failed',
        progress: { step: 'erreur', step_number: 0, total_steps: 6, percent: 0, message: 'Erreur lors de l\'importation des resultats.' },
        error: 'L\'importation des resultats a echoue. Vous pouvez reessayer.',
      })
    }
  }

  // If N8N marked as completed but no results yet (edge case: completed_at is set)
  if (state.current_step_key === 'termine' && !state.results_json) {
    return successResponse({
      status: 'analyzing',
      progress: {
        step: 'importation',
        step_number: 6,
        total_steps: 6,
        percent: 95,
        message: 'Finalisation et stockage des resultats...',
      },
    })
  }

  // If N8N reports failure
  if (state.status === 'failed' || state.error_message) {
    await supabase
      .from('missions')
      .update({ status: 'analysis_failed', updated_at: new Date().toISOString() })
      .eq('id', missionId)

    await createTrace({
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia',
      actor_name: "Sof'IA",
      action: 'analysis_failed',
      target_type: 'mission',
      target_id: missionId,
      details: `Pre-analyse echouee : ${state.error_message ?? 'Erreur inconnue'}`,
    })

    return successResponse({
      status: 'failed',
      progress: {
        step: 'erreur',
        step_number: state.current_step ?? 0,
        total_steps: 6,
        percent: state.progress_percent ?? 0,
        message: state.progress_message ?? 'La pre-analyse a echoue.',
      },
      error: state.error_message ?? 'L\'analyse a echoue. Vous pouvez relancer la pre-analyse.',
    })
  }

  // Still processing — return current progress
  return successResponse({
    status: 'analyzing',
    progress: {
      step: state.current_step_key ?? 'traitement',
      step_number: state.current_step ?? 1,
      total_steps: 6,
      percent: state.progress_percent ?? 0,
      message: state.progress_message ?? 'Pre-analyse en cours...',
    },
  })
}

// ---------------------------------------------------------------
// Import transformed results into Supabase tables
// ---------------------------------------------------------------

async function importTransformedResults(
  missionId: string,
  licenseId: string,
  transformed: ReturnType<typeof transformN8NResults>
): Promise<void> {
  const supabase = createServerSupabaseClient()

  // Find the FEC document for this mission
  const { data: fecDoc } = await supabase
    .from('documents')
    .select('id')
    .eq('mission_id', missionId)
    .eq('type', 'fec')
    .limit(1)
    .single()

  // If not found by mission_id, try by project_id
  let fecDocId = fecDoc?.id ?? null
  if (!fecDocId) {
    const { data: missionData } = await supabase
      .from('missions')
      .select('project_id')
      .eq('id', missionId)
      .single()

    if (missionData?.project_id) {
      const { data: projectFec } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', missionData.project_id)
        .eq('type', 'fec')
        .limit(1)
        .single()
      fecDocId = projectFec?.id ?? null
    }
  }

  // 1. Import completeness
  if (transformed.completeness.length > 0) {
    const rows = transformed.completeness.map((c) => ({
      mission_id: missionId,
      license_id: licenseId,
      doc_type: c.doc_type,
      label: c.label,
      required: c.required,
      status: c.status,
      count: c.count,
      note: c.note,
    }))

    const { error } = await supabase.from('completeness').insert(rows)
    if (error) console.error('Erreur import completeness:', error.message)
  }

  // 2. Import ecritures (sampled entries)
  const ecritureIdMap: Record<string, string> = {}

  if (transformed.ecritures.length > 0) {
    const rows = transformed.ecritures.map((e) => ({
      mission_id: missionId,
      license_id: licenseId,
      document_id: fecDocId,
      journal_code: e.journal_code,
      ecriture_date: e.ecriture_date,
      compte_num: e.compte_num,
      piece_ref: e.piece_ref,
      ecriture_lib: e.ecriture_lib,
      debit: e.debit,
      credit: e.credit,
    }))

    const { data: inserted, error } = await supabase
      .from('ecritures')
      .insert(rows)
      .select('id')

    if (error) {
      console.error('Erreur import ecritures:', error.message)
    } else if (inserted) {
      for (let i = 0; i < transformed.ecritures.length && i < inserted.length; i++) {
        const ref = transformed.ecritures[i].piece_ref
        if (ref) ecritureIdMap[ref] = inserted[i].id
      }
    }
  }

  // 3. Import rapprochements
  const rapprochementIdMap: Record<string, string> = {}

  if (transformed.rapprochements.length > 0) {
    const rows = transformed.rapprochements.map((r) => {
      const ecritureId = ecritureIdMap[r.piece_ref] ?? null
      return {
        mission_id: missionId,
        license_id: licenseId,
        ecriture_id: ecritureId,
        document_id: null,
        match_type: r.match_type,
        match_details: r.match_details,
        confidence: r.confidence,
        created_by: 'sofia',
      }
    })

    // Only insert rows with valid ecriture_id (FK constraint)
    const validRows = rows.filter((r) => r.ecriture_id !== null)
    if (validRows.length > 0) {
      const { data: inserted, error } = await supabase
        .from('rapprochements')
        .insert(validRows)
        .select('id')

      if (error) {
        console.error('Erreur import rapprochements:', error.message)
      } else if (inserted) {
        for (let i = 0; i < validRows.length && i < inserted.length; i++) {
          const ref = transformed.rapprochements[i]?.piece_ref
          if (ref) rapprochementIdMap[ref] = inserted[i].id
        }
      }
    }
  }

  // 4. Import signals
  if (transformed.signals.length > 0) {
    const rows = transformed.signals.map((s) => {
      const pieceRef = s.source_extract?.match(/Piece\s+(\d+)/)?.[1]
        || s.description?.match(/Piece\s+(\d+)/)?.[1]
        || null

      return {
        mission_id: missionId,
        license_id: licenseId,
        document_id: null,
        ecriture_id: pieceRef ? (ecritureIdMap[pieceRef] ?? null) : null,
        rapprochement_id: pieceRef ? (rapprochementIdMap[pieceRef] ?? null) : null,
        type: s.type,
        description: s.description,
        source_document: s.source_document,
        source_page: s.source_page,
        source_extract: s.source_extract,
        rule_triggered: s.rule_triggered,
        rule_description: s.rule_description,
        priority: s.priority,
        explicability: s.explicability,
        human_decision: 'pending' as const,
        human_comment: null,
        decided_at: null,
        confidence_score: s.confidence_score,
      }
    })

    const { error } = await supabase.from('signals').insert(rows)
    if (error) console.error('Erreur import signals:', error.message)
  }

  // 5. Store synthesis as deliverable content_json (no file generation yet)
  if (transformed.synthesis) {
    const { error } = await supabase.from('deliverables').insert({
      mission_id: missionId,
      license_id: licenseId,
      type: 'synthese_preanalyse',
      format: 'pdf',
      title: 'Synthese de pre-analyse — Sondage du chiffre d\'affaires',
      generated_at: new Date().toISOString(),
      content_json: {
        synthesis_text: transformed.synthesis,
        summary: transformed.summary,
        generated_by: 'n8n_sondage',
      },
      storage_path: null,
    })
    if (error) console.error('Erreur insert deliverable synthese:', error.message)
  }

  // 6. Create import traces
  const traces = [
    {
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia' as const,
      actor_name: "Sof'IA",
      action: 'fec_parsed' as const,
      target_type: 'mission' as const,
      target_id: missionId,
      details: `FEC analyse : ${transformed.summary.total_ecritures_fec} lignes, CA total ${transformed.summary.ca_total.toLocaleString('fr-FR')} EUR.`,
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia' as const,
      actor_name: "Sof'IA",
      action: 'rapprochement_completed' as const,
      target_type: 'mission' as const,
      target_id: missionId,
      details: `Rapprochement termine : ${transformed.rapprochements.length} pieces testees (${transformed.summary.methode_echantillonnage}).`,
    },
    {
      mission_id: missionId,
      license_id: licenseId,
      actor: 'sofia' as const,
      actor_name: "Sof'IA",
      action: 'signals_generated' as const,
      target_type: 'mission' as const,
      target_id: missionId,
      details: `${transformed.signals.length} signaux documentaires detectes sur ${transformed.summary.pieces_testees} pieces testees.`,
    },
  ]

  const { error: tracesError } = await supabase.from('traces').insert(traces)
  if (tracesError) console.error('Erreur import traces:', tracesError.message)
}
