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
import { hasRealPdfUploads, analyzePointageFromRealPdfs } from '@/lib/services/pointage-real-analyzer'
import { analyzeCutoffMission, analyzeCutoffFromDocuments } from '@/lib/services/cutoff-analyzer'

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

  // Allow re-launch from analyzed/completed states (for project-based missions)
  const validStatesForAnalysis = ['created', 'documents_ready', 'upload_failed', 'analysis_failed', 'analyzed', 'in_review', 'completed']
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

  // Parse body for optional document_ids and options
  let bodyData: { document_ids?: string[]; options?: Record<string, unknown> } = {}
  try {
    bodyData = await req.json()
  } catch {
    // No body or invalid JSON — proceed without specific doc selection
  }

  // If re-launching (mission already analyzed), clean old analysis data
  const relaunchStates = ['analyzed', 'in_review', 'completed']
  if (relaunchStates.includes(mission.status)) {
    await Promise.all([
      supabase.from('signals').delete().eq('mission_id', missionId),
      supabase.from('rapprochements').delete().eq('mission_id', missionId),
      supabase.from('ecritures').delete().eq('mission_id', missionId),
      supabase.from('completeness').delete().eq('mission_id', missionId),
    ])

    // Clean deliverable files from storage
    const { data: oldDeliverables } = await supabase
      .from('deliverables')
      .select('storage_path')
      .eq('mission_id', missionId)

    if (oldDeliverables && oldDeliverables.length > 0) {
      const paths = oldDeliverables.map((d) => d.storage_path).filter(Boolean) as string[]
      if (paths.length > 0) {
        await supabase.storage.from('deliverables').remove(paths)
      }
    }
    await supabase.from('deliverables').delete().eq('mission_id', missionId)
  }

  // Get documents: from project (via document_ids) or legacy mission documents
  let documents: Array<{
    id: string; type: string; filename: string; storage_path: string;
    file_size: number | null; status: string; mission_id?: string | null; project_id?: string | null;
  }> | null = null

  if (bodyData.document_ids && bodyData.document_ids.length > 0 && mission.project_id) {
    // Project-based: fetch specific documents by IDs from the project
    const { data: projectDocs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', mission.project_id)
      .in('id', bodyData.document_ids)

    if (docsError) {
      return errorResponse('Erreur lors de la recuperation des documents.', 'INTERNAL_ERROR', 500)
    }
    documents = projectDocs
  } else if (mission.project_id) {
    // Project-based but no specific IDs: get all project documents
    const { data: projectDocs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', mission.project_id)

    if (docsError) {
      return errorResponse('Erreur lors de la recuperation des documents.', 'INTERNAL_ERROR', 500)
    }
    documents = projectDocs
  } else {
    // Legacy: get documents directly from mission
    const { data: missionDocs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('mission_id', missionId)

    if (docsError) {
      return errorResponse('Erreur lors de la recuperation des documents.', 'INTERNAL_ERROR', 500)
    }
    documents = missionDocs
  }

  if (!documents || documents.length === 0) {
    return errorResponse(
      'Aucun document disponible pour cette analyse. Ajoutez des documents au projet avant de lancer la pre-analyse.',
      'VALIDATION_ERROR',
      400
    )
  }

  // --- POINTAGE BYPASS: Local analysis without N8N ---
  if (mission.scenario === 'pointage') {
    // Project-based missions: user-uploaded documents are always real.
    // Demo pattern detection only applies to legacy missions without a project.
    const isRealPdfs = mission.project_id
      ? (documents && documents.length > 0)
      : await hasRealPdfUploads(supabase, missionId)

    if (isRealPdfs || mission.company_id) {
      // Update status to analyzing
      await supabase
        .from('missions')
        .update({ status: 'analyzing', updated_at: new Date().toISOString() })
        .eq('id', missionId)

      // Create trace: analysis_started
      const actorNamePointage = await getActorName(session.license_id)
      const analysisMode = isRealPdfs ? 'documents réels (extraction PDF + IA)' : 'données fictives'
      await createTrace({
        mission_id: missionId,
        license_id: session.license_id,
        actor: 'user',
        actor_name: actorNamePointage,
        action: 'analysis_started',
        target_type: 'mission',
        target_id: missionId,
        details: `Pre-analyse lancee sur ${documents?.length || 0} document(s) — Scenario : pointage (${analysisMode})`,
      })

      try {
        let result

        if (isRealPdfs) {
          // New: Real PDF extraction + LLM structuring
          console.log('[Analysis] Vrais PDFs détectés — lancement extraction PDF + LLM...')
          result = await analyzePointageFromRealPdfs(
            supabase,
            missionId,
            session.license_id,
            mission.project_id
          )
        } else {
          // Existing: Fictional company data
          result = await analyzePointageMission(
            supabase,
            missionId,
            session.license_id,
            mission.company_id!
          )
        }

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
          isRealPdfs
            ? `Erreur lors de la pre-analyse des documents PDF : ${errorMessage}`
            : 'Erreur lors de la pre-analyse locale des etats financiers.',
          'ANALYSIS_FAILED',
          500
        )
      }
    }

    // Pointage mission without real PDFs and without company_id — cannot analyze
    return errorResponse(
      'Aucune donnée disponible pour la pré-analyse. Uploadez des documents PDF ou sélectionnez une entreprise démo.',
      'VALIDATION_ERROR',
      400
    )
  }

  // --- CUTOFF BYPASS: Local analysis without N8N ---
  if (mission.scenario === 'cutoff') {
    const CUTOFF_DEMO_PATTERNS = [
      /^FEC_[a-z_]+_\d{4}\.txt$/i,
      /^(?:FAC|FRN|AV)-\d{4}-\d{4}\.pdf$/i,
      /^(?:BL|BR)-\d{4}-\d{4}\.pdf$/i,
    ]
    const CUTOFF_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']

    // Detect if ALL documents match demo patterns (generated by cutoff-pdf-generator).
    // If mission has a company_id and all docs are demo-generated, use the fast
    // in-memory path which is deterministic and doesn't depend on LLM extraction.
    const allDocsMatchDemoPatterns = documents!.every((doc) => {
      return CUTOFF_DEMO_PATTERNS.some((pattern) => pattern.test(doc.filename))
    })
    const useDemoPath = mission.company_id && allDocsMatchDemoPatterns

    const hasRealDocs = !useDemoPath && documents!.some((doc) => {
      const filename = doc.filename
      const isImage = CUTOFF_IMAGE_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))
      return isImage || !CUTOFF_DEMO_PATTERNS.some((pattern) => pattern.test(filename))
    })
    const isRealCutoffDocs = !useDemoPath && (!!mission.project_id || hasRealDocs)

    if (useDemoPath || isRealCutoffDocs || mission.company_id) {
      await supabase
        .from('missions')
        .update({ status: 'analyzing', updated_at: new Date().toISOString() })
        .eq('id', missionId)

      const actorNameCutoff = await getActorName(session.license_id)
      const cutoffMode = useDemoPath
        ? 'données de démonstration'
        : isRealCutoffDocs ? 'documents réels (extraction FEC + PDF)' : 'données fictives'
      await createTrace({
        mission_id: missionId,
        license_id: session.license_id,
        actor: 'user',
        actor_name: actorNameCutoff,
        action: 'analysis_started',
        target_type: 'mission',
        target_id: missionId,
        details: `Pre-analyse lancee sur ${documents?.length || 0} document(s) — Scenario : cutoff (${cutoffMode})`,
      })

      try {
        let result

        if (useDemoPath) {
          // Demo documents from cutoff-pdf-generator: use in-memory company data
          // (deterministic, includes injected discrepancies, no LLM dependency)
          console.log(`[Analysis] Documents démo cutoff détectés — analyse in-memory pour ${mission.company_id}`)
          result = await analyzeCutoffMission(
            supabase,
            missionId,
            session.license_id,
            mission.company_id!
          )
        } else if (isRealCutoffDocs) {
          console.log('[Analysis] Vrais documents cutoff détectés — lancement extraction FEC + PDF...')
          result = await analyzeCutoffFromDocuments(
            supabase,
            missionId,
            session.license_id,
            mission.project_id
          )
        } else {
          result = await analyzeCutoffMission(
            supabase,
            missionId,
            session.license_id,
            mission.company_id!
          )
        }

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
        console.error('Erreur analyse cutoff locale:', errorMessage)

        await supabase
          .from('missions')
          .update({ status: 'analysis_failed', updated_at: new Date().toISOString() })
          .eq('id', missionId)

        return errorResponse(
          isRealCutoffDocs
            ? `Erreur lors de la pre-analyse des documents réels : ${errorMessage}`
            : `Erreur lors de la pre-analyse des documents de cut-off : ${errorMessage}`,
          'ANALYSIS_FAILED',
          500
        )
      }
    }

    // Cutoff mission without real docs and without company_id — cannot analyze
    return errorResponse(
      'Aucune donnée disponible pour la pré-analyse. Uploadez des documents ou sélectionnez une entreprise démo.',
      'VALIDATION_ERROR',
      400
    )
  }

  // --- STANDARD N8N ANALYSIS (sondage_ca) ---

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
      type: doc.type as import('@/types/database').DocumentType,
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

  // Use analysis options from already-parsed body
  const analysisOptions: { cutoff_window_days?: number; priority_threshold?: SignalPriority } =
    (bodyData.options as { cutoff_window_days?: number; priority_threshold?: SignalPriority }) ?? {}

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
