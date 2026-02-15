// =============================================================================
// GET /api/missions/[id]/signals/[signalId]  — Signal detail with full explicability
// PATCH /api/missions/[id]/signals/[signalId] — Update signal decision (human validation)
//
// Rules:
//   - All signals start with human_decision = 'pending'
//   - NO signal can be auto-dismissed
//   - Comment is MANDATORY when rejecting a signal
//   - Every decision creates an immutable trace entry
//   - Never use forbidden vocabulary (anomalie, significatif, fraude)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionFromServerCookies } from '@/lib/auth/session'
import type { HumanDecision, TraceAction } from '@/types/database'

const VALID_DECISIONS: HumanDecision[] = ['validated', 'rejected', 'to_investigate']

// Map decision values to trace actions
const DECISION_TO_ACTION: Record<string, TraceAction> = {
  validated: 'signal_validated',
  rejected: 'signal_rejected',
  to_investigate: 'signal_to_investigate',
}

// Map decision values to French labels for trace details
const DECISION_LABELS: Record<string, string> = {
  validated: 'Signal valide',
  rejected: 'Signal rejete',
  to_investigate: 'Signal a approfondir',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    // 1. Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId, signalId } = await params
    const supabase = createServerSupabaseClient()

    // 2. Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, license_id')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission non trouvee.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 3. Fetch signal with full detail
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .eq('mission_id', missionId)
      .single()

    if (signalError || !signal) {
      return NextResponse.json(
        { error: 'Signal non trouve.', code: 'SIGNAL_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 4. Fetch related ecriture if linked
    let ecriture = null
    if (signal.ecriture_id) {
      const { data } = await supabase
        .from('ecritures')
        .select('*')
        .eq('id', signal.ecriture_id)
        .single()
      ecriture = data
    }

    // 5. Fetch related rapprochement if linked
    let rapprochement = null
    if (signal.rapprochement_id) {
      const { data } = await supabase
        .from('rapprochements')
        .select('*')
        .eq('id', signal.rapprochement_id)
        .single()
      rapprochement = data
    }

    // 6. Fetch related document if linked
    let document = null
    if (signal.document_id) {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', signal.document_id)
        .single()
      document = data
    }

    // 7. Return signal with full explicability and related data
    return NextResponse.json({
      data: {
        ...signal,
        related_ecriture: ecriture,
        related_rapprochement: rapprochement,
        related_document: document,
      },
    })
  } catch (error) {
    console.error('Erreur inattendue dans GET /signals/[signalId]:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signalId: string }> }
) {
  try {
    // 1. Verify session
    const session = await getSessionFromServerCookies()
    if (!session) {
      return NextResponse.json(
        { error: 'Session non valide. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { id: missionId, signalId } = await params
    const supabase = createServerSupabaseClient()

    // 2. Parse and validate request body
    let body: { human_decision: string; comment?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Corps de requete invalide.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const { human_decision, comment } = body

    // 3. Validate decision value
    if (!human_decision || !VALID_DECISIONS.includes(human_decision as HumanDecision)) {
      return NextResponse.json(
        {
          error: `Decision invalide. Valeurs acceptees : ${VALID_DECISIONS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // 4. Comment is MANDATORY when rejecting a signal
    if (human_decision === 'rejected' && (!comment || comment.trim().length === 0)) {
      return NextResponse.json(
        {
          error: 'Un commentaire est obligatoire pour rejeter un signal documentaire. Veuillez justifier votre decision.',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // 5. Verify mission belongs to this license
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('id, license_id')
      .eq('id', missionId)
      .eq('license_id', session.license_id)
      .single()

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Mission non trouvee.', code: 'MISSION_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 6. Verify signal exists in this mission
    const { data: existingSignal, error: signalCheckError } = await supabase
      .from('signals')
      .select('id, rule_triggered, type, description')
      .eq('id', signalId)
      .eq('mission_id', missionId)
      .single()

    if (signalCheckError || !existingSignal) {
      return NextResponse.json(
        { error: 'Signal non trouve.', code: 'SIGNAL_NOT_FOUND' },
        { status: 404 }
      )
    }

    // 7. Update signal decision
    const decidedAt = new Date().toISOString()
    const { data: updatedSignal, error: updateError } = await supabase
      .from('signals')
      .update({
        human_decision: human_decision as HumanDecision,
        human_comment: comment?.trim() || null,
        decided_at: decidedAt,
      })
      .eq('id', signalId)
      .eq('mission_id', missionId)
      .select('*')
      .single()

    if (updateError || !updatedSignal) {
      console.error('Erreur lors de la mise a jour du signal:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise a jour du signal.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }

    // 8. Get CAC profile for trace actor_name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, inscription_cncc')
      .eq('license_id', session.license_id)
      .single()

    const actorName = profile
      ? `${profile.name}, CAC (${profile.inscription_cncc || 'CNCC'})`
      : 'Commissaire aux comptes'

    // 9. Create immutable trace entry for the decision
    const traceAction = DECISION_TO_ACTION[human_decision]
    const decisionLabel = DECISION_LABELS[human_decision]
    const ruleInfo = existingSignal.rule_triggered
      ? ` (${existingSignal.rule_triggered})`
      : ''
    const commentInfo = comment?.trim()
      ? ` — "${comment.trim()}"`
      : ''

    const { error: traceError } = await supabase
      .from('traces')
      .insert({
        mission_id: missionId,
        license_id: session.license_id,
        timestamp: decidedAt,
        actor: 'user',
        actor_name: actorName,
        action: traceAction,
        target_type: 'signal',
        target_id: signalId,
        details: `${decisionLabel}${ruleInfo}${commentInfo}`,
      })

    if (traceError) {
      // Log but do not fail the request — the signal update already succeeded
      console.error('Erreur lors de la creation de la trace:', traceError)
    }

    // 10. Check if all signals have been decided and update mission status if needed
    const { data: pendingSignals } = await supabase
      .from('signals')
      .select('id', { count: 'exact' })
      .eq('mission_id', missionId)
      .eq('human_decision', 'pending')

    // If no pending signals remain, transition mission to 'in_review' (if not already completed)
    if (pendingSignals && pendingSignals.length === 0) {
      await supabase
        .from('missions')
        .update({
          status: 'in_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', missionId)
        .in('status', ['analyzed', 'in_review'])
    }

    return NextResponse.json({ data: updatedSignal })
  } catch (error) {
    console.error('Erreur inattendue dans PATCH /signals/[signalId]:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
